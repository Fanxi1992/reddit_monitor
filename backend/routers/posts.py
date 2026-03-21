"""
帖子相关 API 路由。

这一层只负责：
1. 定义 URL 路径与 HTTP 方法。
2. 声明请求体、查询参数和响应模型。
3. 调用 CRUD 层处理真实业务逻辑。

这样做的好处是：
Router 保持轻量，业务规则都留在 crud.py 中统一维护。
"""

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from backend import crud, schemas
from backend.database import get_db


router = APIRouter(
    prefix="/api/posts",
    tags=["Posts"],
)


@router.post(
    "/",
    response_model=schemas.PostResponse,
    status_code=status.HTTP_201_CREATED,
    summary="登记新的 Reddit 帖子链接",
)
def create_post(
    post_in: schemas.PostCreate,
    db: Session = Depends(get_db),
):
    """
    登记新帖子。

    后端会自动完成：
    1. 从 URL 提取 reddit_id
    2. 查重
    3. 写入数据库
    """

    return crud.create_post(db=db, post_in=post_in)


@router.get(
    "/",
    response_model=list[schemas.PostResponse],
    summary="获取帖子列表，可按客户 ID 筛选",
)
def get_posts(
    client_id: int | None = Query(
        default=None,
        description="客户主数据 ID，传入后按该客户精确筛选",
    ),
    unassigned: bool = Query(
        default=False,
        description="是否只返回未分配客户的帖子。为 true 时优先于 client_id。",
    ),
    db: Session = Depends(get_db),
):
    """
    获取帖子列表。

    规则：
    1. 如果 unassigned=true，则只返回 client_id 为空的帖子。
    2. 否则如果传了 client_id，则只返回该客户对应的数据。
    3. 两者都不传时，返回全部帖子。
    """

    return crud.get_posts(
        db=db,
        client_id=client_id,
        unassigned=unassigned,
    )


@router.put(
    "/{post_id}/note",
    response_model=schemas.PostResponse,
    summary="覆盖更新运营备注",
)
def update_operator_note(
    post_id: int,
    note_update: schemas.NoteUpdate,
    db: Session = Depends(get_db),
):
    """
    覆盖更新帖子备注。

    注意这里不是追加，而是完整覆盖。
    前端应提交最终编辑好的整段备注内容。
    """

    return crud.update_operator_note(
        db=db,
        post_id=post_id,
        note_update=note_update,
    )


@router.get(
    "/{post_id}/tracking",
    response_model=list[schemas.TrackingLogResponse],
    summary="获取帖子的追踪时间序列数据",
)
def get_post_tracking_data(
    post_id: int,
    db: Session = Depends(get_db),
):
    """
    获取某条帖子的全部 tracking_logs 节点。

    返回结果已经按 scraped_at 升序排好，
    前端可以直接用来画折线图。
    """

    return crud.get_post_tracking_data(db=db, post_id=post_id)


@router.get(
    "/{post_id}/screenshots",
    response_model=list[schemas.ScreenshotResponse],
    summary="获取帖子的截图留存记录",
)
def get_post_screenshots(
    post_id: int,
    db: Session = Depends(get_db),
):
    """
    获取某条帖子的全部截图记录。

    返回结果已按 day_mark 升序排好，
    前端后续可以直接按“第 0 / 1 / 2 / 4 / 7 天”展示。
    """

    return crud.get_post_screenshots(db=db, post_id=post_id)
