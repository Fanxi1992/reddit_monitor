"""
核心数据库模型定义。

本轮重构后，数据库会围绕三张核心表展开：
1. clients：客户主数据表，负责统一维护“可被选择的客户范围”
2. posts：帖子登记主表，改为通过 client_id 关联客户
3. tracking_logs：帖子追踪日志表，记录帖子在真实时间轴上的互动快照

设计原则：
1. 客户名称不再允许在帖子中自由手写，而是改为受控主数据。
2. posts 表负责记录“这条帖子属于哪个客户、是什么、当前状态如何”。
3. tracking_logs 表负责记录“这条帖子在某个真实时间点的互动快照”。
"""

from datetime import datetime, timezone

from sqlalchemy import Column, DateTime, ForeignKey, Index, Integer, String, Text
from sqlalchemy.orm import relationship

from backend.database import Base


def utc_now() -> datetime:
    """
    统一返回“当前 UTC 时间”。

    这里主动去掉 tzinfo，原因是 MySQL 常见的 DATETIME 字段默认不保存时区信息。
    因此我们采用一个团队内非常常见的策略：
    “数据库统一存 UTC 的无时区时间，前端展示时再按需要转换为本地时区”。
    """

    return datetime.now(timezone.utc).replace(tzinfo=None)


class Post(Base):
    """
    帖子登记主表。

    这张表是业务的主索引表，负责描述一条 Reddit 帖子的基础信息与当前状态。
    最关键字段是 reddit_id，它是整套系统防重复登记的核心。
    """

    __tablename__ = "posts"

    # 自增主键，作为数据库内部关联 ID 使用。
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)

    # Reddit 帖子的唯一业务标识。
    # 这里必须唯一，因为同一条帖子可能带着不同 URL 参数重复出现，
    # 但最终都应被归并到同一个 reddit_id。
    reddit_id = Column(String(32), unique=True, index=True, nullable=False)

    # 运营人员录入的原始帖子链接。
    # 长度预留到 1024，避免 URL 带 query 参数时被截断。
    url = Column(String(1024), nullable=False)

    # 帖子标题。
    # 这里使用 String(500) 基本足够，既能覆盖常见场景，又不会过度浪费索引空间。
    title = Column(String(500), nullable=False)

    # 客户外键。
    # 这里不再直接保存自由文本客户名称，而是统一引用 clients 表中的主数据。
    # ondelete='SET NULL' 的意义是：
    # 如果某个客户被删除，历史帖子仍然保留，但它们会被自动标记为“未分配客户”。
    client_id = Column(
        Integer,
        ForeignKey("clients.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    # 运营备注。
    # 使用 Text 而不是 String，方便未来持续追加记录，例如：
    # “03/19 已发布；03/20 已补赞 50；03/21 已补评论 3 条”
    operator_note = Column(Text, nullable=True)

    # 帖子当前状态。
    # 默认 Active；若后续抓取发现正文为 [removed]，则更新为 Removed。
    status = Column(String(20), nullable=False, default="Active", index=True)

    # 录入系统时间。
    # 这是后端调度逻辑的重要依据，用于判断帖子当前处于：
    # - 0~2 天高频追踪区间
    # - 2~7 天低频追踪区间
    created_at = Column(DateTime, nullable=False, default=utc_now, index=True)

    # 关联到客户主数据。
    # 不使用 delete-orphan，因为删除客户时不应该删除帖子本身。
    client = relationship("Client", back_populates="posts")

    # 与 tracking_logs 建立一对多关系。
    # 一条帖子可以有很多次抓取记录。
    tracking_logs = relationship(
        "TrackingLog",
        back_populates="post",
        cascade="all, delete-orphan",
        order_by="TrackingLog.scraped_at",
    )

    # 与 screenshot_logs 建立一对多关系。
    # 每条帖子在第 0 / 1 / 2 / 4 / 7 天最多各有一张成功截图。
    screenshots = relationship(
        "ScreenshotLog",
        back_populates="post",
        cascade="all, delete-orphan",
        order_by="ScreenshotLog.day_mark",
    )

    @property
    def client_name(self) -> str | None:
        """
        给 API 响应层提供一个稳定的展示字段。

        由于数据库已经改成 client_id 外键模式，前端仍然希望直接拿到 client_name
        作为展示文本，因此在 ORM 层提供一个只读属性最合适。
        """

        if not self.client:
            return None
        return self.client.name


class Client(Base):
    """
    客户主数据表。

    这张表的职责不是记录业务行为，而是统一维护“允许被选择的客户范围”。
    这样可以从源头避免运营手写客户名时出现大小写不一致、缩写不同等问题。
    """

    __tablename__ = "clients"

    # 自增主键，供 posts.client_id 关联使用。
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)

    # 客户展示名称。
    # 这是前端下拉列表和看板中直接展示给运营看的文本。
    name = Column(String(255), nullable=False)

    # 客户名称归一化字段。
    # 这里使用 strip + lower 作为规则，并设置唯一索引，
    # 以此实现大小写不敏感的去重约束。
    normalized_name = Column(String(255), nullable=False, unique=True, index=True)

    # 客户主数据创建时间。
    created_at = Column(DateTime, nullable=False, default=utc_now, index=True)

    # 一个客户可以对应多条帖子。
    # passive_deletes=True 能更好地配合数据库级的 ondelete 行为。
    posts = relationship(
        "Post",
        back_populates="client",
        passive_deletes=True,
    )


class TrackingLog(Base):
    """
    帖子追踪日志表。

    这张表本质上是时间序列表，用于记录一条帖子在某个采样时刻的互动数据快照。
    前端折线图的 X 轴，就应该直接使用 scraped_at，而不是人为拼接的序号。
    """

    __tablename__ = "tracking_logs"

    # 自增主键，便于日志记录本身被唯一标识。
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)

    # 外键关联 posts.id。
    # ondelete='CASCADE' 表示当某条帖子被删除时，它的追踪日志也一并删除，
    # 避免产生孤儿数据。
    post_id = Column(
        Integer,
        ForeignKey("posts.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # 当前抓取到的点赞数。
    upvotes = Column(Integer, nullable=False, default=0)

    # 当前抓取到的评论数。
    comments = Column(Integer, nullable=False, default=0)

    # 抓取完成时间。
    # 这是整个时间轴可视化的关键字段，必须记录真实时间。
    scraped_at = Column(DateTime, nullable=False, default=utc_now, index=True)

    # 回指所属帖子对象，和 Post.tracking_logs 对应。
    post = relationship("Post", back_populates="tracking_logs")


class ScreenshotLog(Base):
    """
    帖子截图留存日志表。

    这张表用于保存“商业结算凭证”截图的本地落库记录。
    注意数据库里不保存 Apify 的临时 screenshotUrl，
    只保存下载到本地服务器后的相对文件路径。
    """

    __tablename__ = "screenshot_logs"

    # 自增主键，作为截图记录本身的唯一标识。
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)

    # 外键关联 posts.id。
    # 若帖子被删除，对应截图记录也级联删除，避免产生孤儿数据。
    post_id = Column(
        Integer,
        ForeignKey("posts.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # 业务截图日标。
    # 例如：
    # - 1 表示发帖后第 1 天
    # - 3 表示发帖后第 3 天
    day_mark = Column(Integer, nullable=False)

    # 本地服务器上的相对路径。
    # 例如：
    # static/screenshots/post_123_day_3_20260320T080000123456Z.png
    file_path = Column(String(512), nullable=False)

    # 实际截图并成功保存到本地的时间。
    captured_at = Column(DateTime, nullable=False, default=utc_now, index=True)

    # 回指所属帖子对象，和 Post.screenshots 对应。
    post = relationship("Post", back_populates="screenshots")


# 为高频查询场景补充一个复合索引。
# 后续最常见的查询之一，就是“按帖子 ID 读取它的全部时间序列，并按抓取时间排序”。
Index("idx_tracking_logs_post_id_scraped_at", TrackingLog.post_id, TrackingLog.scraped_at)

# 同一条帖子在同一个 day_mark 只允许保留一张成功截图。
Index(
    "uq_screenshot_logs_post_id_day_mark",
    ScreenshotLog.post_id,
    ScreenshotLog.day_mark,
    unique=True,
)
