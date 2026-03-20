"""
客户主数据相关 API 路由。

这一层只负责：
1. 暴露客户列表、新增、删除接口。
2. 声明请求体和响应模型。
3. 调用 CRUD 层处理真实业务逻辑。
"""

from fastapi import APIRouter, Depends, Response, status
from sqlalchemy.orm import Session

from backend import crud, schemas
from backend.database import get_db


router = APIRouter(
    prefix="/api/clients",
    tags=["Clients"],
)


@router.get(
    "/",
    response_model=list[schemas.ClientResponse],
    summary="获取全部客户主数据",
)
def get_clients(db: Session = Depends(get_db)):
    """
    获取全部客户。

    前端会基于这份数据做：
    1. 登记页可检索选择器
    2. 右侧客户管理面板
    3. Dashboard 客户筛选下拉框
    """

    return crud.get_clients(db=db)


@router.post(
    "/",
    response_model=schemas.ClientResponse,
    status_code=status.HTTP_201_CREATED,
    summary="创建客户主数据",
)
def create_client(
    client_in: schemas.ClientCreate,
    db: Session = Depends(get_db),
):
    """
    创建新的客户主数据。

    后端会自动进行大小写不敏感去重。
    """

    return crud.create_client(db=db, client_in=client_in)


@router.delete(
    "/{client_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="删除客户主数据并解绑历史帖子",
)
def delete_client(
    client_id: int,
    db: Session = Depends(get_db),
):
    """
    删除客户。

    当前业务规则是：
    1. 允许删除已经被帖子引用过的客户。
    2. 删除时自动把历史帖子解绑成“未分配客户”。
    """

    crud.delete_client(db=db, client_id=client_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
