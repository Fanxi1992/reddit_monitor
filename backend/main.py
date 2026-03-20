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

from backend.database import Base, engine
from backend import models
from backend.routers import clients as clients_router
from backend.routers import posts as posts_router
from backend.scheduler import shutdown_scheduler, start_scheduler


PROJECT_ROOT = Path(__file__).resolve().parent.parent
STATIC_DIR = PROJECT_ROOT / "static"
SCREENSHOTS_DIR = STATIC_DIR / "screenshots"


def ensure_static_directories() -> None:
    """
    确保静态资源目录存在。

    这里在应用启动前就创建 static/screenshots，
    这样 FastAPI 在挂载 StaticFiles 时不会因为目录不存在而报错。
    """

    SCREENSHOTS_DIR.mkdir(parents=True, exist_ok=True)


ensure_static_directories()


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
