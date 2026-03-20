"""
Pydantic 数据模型定义。

这一层的职责非常明确：
1. 约束前端传进来的请求体格式。
2. 规范后端返回给前端的响应结构。
3. 让 CRUD 与 Router 之间的契约清晰、稳定、可维护。
"""

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field


class ClientCreate(BaseModel):
    """
    创建客户主数据时的请求体。

    当前只允许前端提交一个客户展示名称，
    归一化去重逻辑由后端统一处理。
    """

    name: str = Field(
        ...,
        min_length=1,
        description="客户展示名称，例如 Acme、Client-A",
    )


class ClientResponse(BaseModel):
    """
    返回给前端的客户主数据结构。
    """

    id: int
    name: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class PostCreate(BaseModel):
    """
    创建帖子时的请求体。

    注意这里不包含 reddit_id，因为 reddit_id 必须由后端根据 URL 自动解析，
    不能交给前端直接传值，否则就失去了统一查重和格式校验的意义。
    """

    url: str = Field(..., description="运营人员录入的 Reddit 帖子链接")
    title: str = Field(..., description="帖子标题")
    client_id: int = Field(..., gt=0, description="客户主数据 ID")
    operator_note: Optional[str] = Field(
        default=None,
        description="运营备注，允许为空",
    )


class PostResponse(BaseModel):
    """
    返回给前端的帖子信息。

    这里包含数据库落库后的完整核心字段，
    便于前端直接做列表展示、筛选、状态展示和详情跳转。
    """

    id: int
    reddit_id: str
    url: str
    title: str
    client_id: Optional[int] = None
    client_name: Optional[str] = None
    operator_note: Optional[str] = None
    status: str
    created_at: datetime

    # 允许直接把 SQLAlchemy ORM 对象转成 Pydantic 响应模型。
    model_config = ConfigDict(from_attributes=True)


class NoteUpdate(BaseModel):
    """
    更新运营备注时的请求体。

    业务规则是“整段覆盖”，不是追加。
    前端把最终编辑好的完整字符串传给后端即可。
    """

    operator_note: str = Field(
        default="",
        description="新的完整备注内容，允许为空字符串",
    )


class TrackingLogResponse(BaseModel):
    """
    返回给前端的追踪日志节点。

    前端拿到该结构后，可以直接使用 scraped_at 作为折线图 X 轴，
    用 upvotes / comments 作为时间序列指标。
    """

    id: int
    post_id: int
    upvotes: int
    comments: int
    scraped_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ScreenshotResponse(BaseModel):
    """
    返回给前端的截图留存记录。

    注意这里只返回数据库中的相对文件路径；
    前端后续可以自行拼接成 /static/... 访问地址。
    """

    id: int
    post_id: int
    day_mark: int
    file_path: str
    captured_at: datetime

    model_config = ConfigDict(from_attributes=True)
