"""
数据库连接配置模块。

这个文件负责完成几件核心事情：
1. 从 backend/.env 中读取 DATABASE_URL。
2. 创建 SQLAlchemy Engine，连接 MySQL。
3. 创建 SessionLocal，供每次请求获取独立数据库会话。
4. 提供 Base，供 models.py 中的 ORM 模型统一继承。
5. 提供 get_db() 依赖，便于 FastAPI 路由中注入数据库会话。
"""

from pathlib import Path
import os

from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker


# 先定位当前文件所在目录，也就是 backend 目录。
BASE_DIR = Path(__file__).resolve().parent

# 明确指定只读取 backend 目录下的 .env 文件。
# 这样可以避免未来项目根目录、前端目录也存在 .env 时互相干扰。
ENV_FILE = BASE_DIR / ".env"
load_dotenv(dotenv_path=ENV_FILE)


# 从环境变量中读取数据库连接字符串。
# 例如：
# mysql+pymysql://root:123456@127.0.0.1:3306/reddit_monitor?charset=utf8mb4
DATABASE_URL = os.getenv("DATABASE_URL")

if not DATABASE_URL:
    raise ValueError(
        "未检测到 DATABASE_URL，请先在 backend/.env 中配置 MySQL 连接字符串。"
    )


# 创建数据库引擎。
# 关键参数说明：
# - pool_pre_ping=True：每次取连接前先做一次探测，避免 MySQL 长连接失效。
# - pool_recycle=3600：连接超过 1 小时后回收，降低 MySQL 'server has gone away' 风险。
# - echo=False：生产或日常开发默认不打印所有 SQL，如需调试可改为 True。
engine = create_engine(
    DATABASE_URL,
    pool_pre_ping=True,
    pool_recycle=3600,
    echo=False,
)


# SessionLocal 是数据库会话工厂。
# 每次请求进来时，通常会生成一个独立 Session；
# 请求结束后再统一关闭，避免连接泄漏。
SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine,
)


# 所有 ORM 模型类都要继承这个 Base。
# 最终 SQLAlchemy 会通过 Base.metadata 统一收集所有表定义。
Base = declarative_base()


def get_db():
    """
    FastAPI 依赖注入函数。

    用法示例：
        db: Session = Depends(get_db)

    作用：
    1. 为单次请求提供数据库会话。
    2. 请求结束后，无论成功还是失败，都确保会话被关闭。
    """

    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
