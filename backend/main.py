"""
FastAPI 应用入口文件。

当前阶段目标：
1. 创建 FastAPI 实例。
2. 应用启动时自动创建数据库表。
3. 提供最基础的健康检查接口，方便你快速确认后端是否启动成功。

后续你可以在这个文件基础上继续拆分：
- routers/
- services/
- crud/
- scheduler/
- apify_client/
"""

from contextlib import asynccontextmanager
import os
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy import inspect, text
from sqlalchemy.orm import sessionmaker

from backend.database import Base, engine
from backend import models
from backend.routers import clients as clients_router
from backend.routers import posts as posts_router
from backend.scheduler import shutdown_scheduler, start_scheduler


PROJECT_ROOT = Path(__file__).resolve().parent.parent
STATIC_DIR = PROJECT_ROOT / "static"
SCREENSHOTS_DIR = STATIC_DIR / "screenshots"
RuntimeSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def ensure_static_directories() -> None:
    """
    确保静态资源目录存在。

    这里在应用启动前就创建 static/screenshots，
    这样 FastAPI 在挂载 StaticFiles 时不会因为目录不存在而报错。
    """

    SCREENSHOTS_DIR.mkdir(parents=True, exist_ok=True)


ensure_static_directories()


def ensure_runtime_schema() -> None:
    """
    为当前阶段补一层极简运行时兼容。

    背景：
    - 项目已经进入内部试用，数据库里可能已有旧版 posts 表。
    - SQLAlchemy 的 create_all() 不会自动给现有表补新列。
    - 本轮新增 post_type 字段，如果不补列，旧库启动后查询 posts 会直接报错。

    当前策略：
    仅在启动时对 posts 主表补齐当前阶段高频展示所需的新列，
    避免老库因为 create_all() 不会补列而直接启动失败。
    """

    inspector = inspect(engine)
    existing_tables = set(inspector.get_table_names())

    if "posts" not in existing_tables:
        return

    existing_columns = {
        column_definition["name"] for column_definition in inspector.get_columns("posts")
    }
    with engine.begin() as connection:
        if "post_type" not in existing_columns:
            connection.execute(
                text(
                    """
                    ALTER TABLE posts
                    ADD COLUMN post_type VARCHAR(20) NOT NULL DEFAULT '其他'
                    """
                )
            )

        if "operator_note_updated_at" not in existing_columns:
            connection.execute(
                text(
                    """
                    ALTER TABLE posts
                    ADD COLUMN operator_note_updated_at DATETIME NULL
                    """
                )
            )

        if "latest_upvotes" not in existing_columns:
            connection.execute(
                text(
                    """
                    ALTER TABLE posts
                    ADD COLUMN latest_upvotes INT NULL
                    """
                )
            )

        if "latest_comments" not in existing_columns:
            connection.execute(
                text(
                    """
                    ALTER TABLE posts
                    ADD COLUMN latest_comments INT NULL
                    """
                )
            )

        if "last_scraped_at" not in existing_columns:
            connection.execute(
                text(
                    """
                    ALTER TABLE posts
                    ADD COLUMN last_scraped_at DATETIME NULL
                    """
                )
            )

        if "is_archived" not in existing_columns:
            connection.execute(
                text(
                    """
                    ALTER TABLE posts
                    ADD COLUMN is_archived BOOLEAN NOT NULL DEFAULT 0
                    """
                )
            )

        if "archived_at" not in existing_columns:
            connection.execute(
                text(
                    """
                    ALTER TABLE posts
                    ADD COLUMN archived_at DATETIME NULL
                    """
                )
            )


def backfill_post_summary_fields() -> None:
    """
    为历史数据补齐 posts 主表中的摘要字段。

    背景：
    - 当前项目已经有 tracking_logs 历史数据。
    - 新版“帖子管理”页希望直接读 posts 主表中的最新点赞、评论和最近抓取时间。
    - 因此对“仍为空”的摘要字段做一次温和回填，避免旧数据全部显示为 --。

    注意：
    1. 这里只回填为空的字段，不覆盖抓取引擎已经回写过的新值。
    2. 如果某条帖子从未抓取过 tracking_logs，就保持 NULL。
    """

    db = RuntimeSessionLocal()
    try:
        candidate_posts = (
            db.query(models.Post)
            .filter(
                (models.Post.last_scraped_at.is_(None))
                | (models.Post.latest_upvotes.is_(None))
                | (models.Post.latest_comments.is_(None))
            )
            .all()
        )

        if not candidate_posts:
            return

        candidate_post_ids = [post.id for post in candidate_posts]
        tracking_logs = (
            db.query(models.TrackingLog)
            .filter(models.TrackingLog.post_id.in_(candidate_post_ids))
            .order_by(
                models.TrackingLog.post_id.asc(),
                models.TrackingLog.scraped_at.desc(),
                models.TrackingLog.id.desc(),
            )
            .all()
        )

        latest_log_by_post_id: dict[int, models.TrackingLog] = {}
        for tracking_log in tracking_logs:
            latest_log_by_post_id.setdefault(tracking_log.post_id, tracking_log)

        has_changes = False
        for post in candidate_posts:
            latest_log = latest_log_by_post_id.get(post.id)
            if not latest_log:
                continue

            if post.last_scraped_at is None:
                post.last_scraped_at = latest_log.scraped_at
                has_changes = True

            if post.latest_upvotes is None:
                post.latest_upvotes = latest_log.upvotes
                has_changes = True

            if post.latest_comments is None:
                post.latest_comments = latest_log.comments
                has_changes = True

        if has_changes:
            db.commit()
        else:
            db.rollback()
    finally:
        db.close()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    FastAPI 生命周期钩子。

    在应用启动时执行 Base.metadata.create_all()，让当前定义好的表自动落库。
    注意：
    - 这非常适合项目初始化和本地开发阶段。
    - 到后期正式环境，建议切换到 Alembic 管理数据库迁移。
    """

    # 导入 models 的目的不是直接使用它，而是确保 ORM 模型已被 SQLAlchemy 注册。
    # 如果没有这一步，Base.metadata 可能收集不到表定义。
    _ = models
    ensure_static_directories()
    Base.metadata.create_all(bind=engine)
    ensure_runtime_schema()
    backfill_post_summary_fields()
    app.state.scheduler = start_scheduler()
    yield
    shutdown_scheduler()


app = FastAPI(
    title=os.getenv("APP_NAME", "Reddit Monitor Backend"),
    description="Reddit 帖子高频监控与可视化追踪系统后端服务",
    version="0.1.0",
    lifespan=lifespan,
)


# 配置跨域访问。
# 当前采用开发期粗放模式：
# 1. 允许任意来源访问。
# 2. 不携带 credentials。
# 3. 允许任意方法和请求头。
# 如果后续进入正式上线阶段，建议再改回明确白名单。
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


# 挂载静态文件目录。
# 这样后续截图保存到 static/screenshots/ 后，
# 前端就能通过 /static/screenshots/xxx.png 直接访问。
app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")


# 注册 API 路由。
# 当前包含：
# 1. posts：帖子登记、备注更新、追踪日志查询
# 2. clients：客户主数据管理
app.include_router(posts_router.router)
app.include_router(clients_router.router)


@app.get("/")
def read_root():
    """
    根路由。

    用于快速确认服务已经启动。
    """

    return {
        "message": "Reddit Monitor Backend is running.",
        "service": "backend",
        "version": "0.1.0",
    }


@app.get("/health")
def health_check():
    """
    健康检查接口。

    未来可以继续扩展成：
    - 检查数据库连通性
    - 检查定时任务调度器状态
    - 检查 Apify 配置是否完整
    """

    return {
        "status": "ok",
        "database_tables_ready": True,
        "scheduler_running": bool(
            getattr(app.state, "scheduler", None)
            and app.state.scheduler.running
        ),
    }
