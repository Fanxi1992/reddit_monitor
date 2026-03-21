"""
数据库 CRUD 与核心业务逻辑。

本轮重构后，这个文件主要负责三类能力：
1. Reddit URL 解析、短链接还原、canonical 长链接生成与 reddit_id 提取。
2. 客户主数据的增删查，确保客户名称大小写不敏感去重。
3. 帖子登记、备注更新、追踪日志查询等业务逻辑。

设计原则：
1. Router 只处理 HTTP 入口，不堆业务细节。
2. 业务规则尽量集中放在 CRUD 层，方便复用和测试。
3. 遇到错误时，直接抛出明确、友好的 HTTPException。
"""

import re
from dataclasses import dataclass
from urllib.parse import urljoin, urlparse

import httpx
from fastapi import HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, joinedload

from backend import models, schemas


# Reddit 标准帖子详情页 URL 中的帖子 ID 提取规则。
# 兼容示例：
# - https://www.reddit.com/r/test/comments/1rsbzpl/post-title/
# - https://reddit.com/comments/1rsbzpl/
# - https://old.reddit.com/r/test/comments/1rsbzpl/post-title/?utm_source=share
REDDIT_COMMENTS_PATTERN = re.compile(
    r"/comments/(?P<reddit_id>[a-z0-9]+)(?:/|$)",
    re.IGNORECASE,
)


# Reddit 短域名提取规则。
# 兼容示例：
# - https://redd.it/1rsbzpl
# - https://www.redd.it/1rsbzpl/
REDDIT_SHORTLINK_PATTERN = re.compile(
    r"^/(?P<reddit_id>[a-z0-9]+)(?:/|$)",
    re.IGNORECASE,
)


# Reddit 移动端 / App 分享短链接解析失败时，统一返回这条更友好的错误。
SHORT_LINK_ERROR_DETAIL = (
    "短链接解析失败或超时，请尝试直接输入浏览器地址栏中的完整帖子链接。"
)


# 伪装成真实手机端浏览器，尽量降低 Reddit 针对脚本请求的风控敏感度。
MOBILE_SAFARI_USER_AGENT = (
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_2 like Mac OS X) "
    "AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 "
    "Mobile/15E148 Safari/604.1"
)


@dataclass(frozen=True)
class ParsedRedditPostURL:
    """
    Reddit 帖子链接解析结果。

    这里同时返回两类信息：
    1. reddit_id：业务唯一标识，用于查重和后续抓取结果配对。
    2. canonical_url：最终标准长链接，用于落库到 posts.url。

    这样做的价值在于：
    - 前端可以继续随意输入多种形式的 Reddit 链接
    - 后端统一收敛成“同一条帖子对应同一个 canonical URL”
    - 后续监控抓取和截图抓取都直接复用 posts.url，不必再做二次转换
    """

    reddit_id: str
    canonical_url: str


def normalize_reddit_url(url: str) -> str:
    """
    统一清洗并补齐 URL。

    处理规则：
    1. 去掉首尾空格。
    2. 如果用户没填协议头，则自动补一个 https://。
    """

    cleaned_url = url.strip()
    if not cleaned_url:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="帖子链接不能为空，请输入有效的 Reddit URL。",
        )

    if not urlparse(cleaned_url).scheme:
        return f"https://{cleaned_url}"

    return cleaned_url


def get_reddit_host_or_raise(url: str) -> str:
    """
    提取并校验 Reddit 域名。

    当前仍然只接受 reddit.com / redd.it 体系的地址，
    其他域名一律视为无效输入。
    """

    parsed_url = urlparse(url)
    host = parsed_url.netloc.lower().split(":")[0]

    if not host:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="帖子链接格式错误，未识别到域名。",
        )

    if (
        host == "reddit.com"
        or host.endswith(".reddit.com")
        or host == "redd.it"
        or host.endswith(".redd.it")
    ):
        return host

    raise HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail="只支持 Reddit 帖子链接，请检查 URL 域名是否正确。",
    )


def extract_reddit_id_from_parsed_url(parsed_url) -> str | None:
    """
    从已经确认是 Reddit 域名的 URL 中尝试提取 reddit_id。

    注意：
    1. 这里只负责“纯提取”，不做网络请求。
    2. 如果当前 URL 还不是标准帖子详情页，则返回 None。
    """

    host = parsed_url.netloc.lower().split(":")[0]
    path = parsed_url.path

    if host == "redd.it" or host.endswith(".redd.it"):
        match = REDDIT_SHORTLINK_PATTERN.match(path)
    else:
        match = REDDIT_COMMENTS_PATTERN.search(path)

    if not match:
        return None

    return match.group("reddit_id").lower()


def is_reddit_share_short_link(parsed_url) -> bool:
    """
    判断当前 URL 是否更像 Reddit 分享短链接。

    典型特征：
    1. 路径中包含 /s/ ，例如：
       https://www.reddit.com/r/xxx/s/abcd1234
    2. 路径中包含 share 且当前又不是标准 comments 详情页。
    3. 查询参数里带 share，而当前路径又提取不出 reddit_id。

    这里故意先做“标准链接直接提取”，再走短链接识别。
    这样可以避免把普通长链接上的 share_id、utm_source=share 误判成短链接。
    """

    lowered_path = parsed_url.path.lower()
    lowered_query = parsed_url.query.lower()

    return (
        "/s/" in lowered_path
        or lowered_path.endswith("/share")
        or "/share/" in lowered_path
        or (
            "share" in lowered_query
            and REDDIT_COMMENTS_PATTERN.search(lowered_path) is None
        )
    )


def resolve_reddit_short_url(short_url: str) -> str:
    """
    轻量级还原 Reddit 短链接背后的真实长链接。

    关键策略：
    1. 使用逼真的手机端 User-Agent 做伪装。
    2. follow_redirects=False，严禁把整条跳转链跑到底。
    3. 优先 HEAD；若 Reddit 不接受 HEAD（例如 405）或不给 Location，
       则回退到 GET。

    最终目标只有一个：从响应头里拿到 Location。
    """

    request_headers = {
        "User-Agent": MOBILE_SAFARI_USER_AGENT,
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        "Referer": "https://www.reddit.com/",
    }

    try:
        with httpx.Client(
            headers=request_headers,
            follow_redirects=False,
            timeout=httpx.Timeout(8.0, connect=5.0),
        ) as client:
            response = client.head(short_url)

            # 某些站点会拒绝 HEAD，或者虽然返回了响应，但根本不给 Location。
            # 这时退回到 GET；由于依然禁止自动跳转，所以流量和风控压力都很低。
            if response.status_code == 405 or not response.headers.get("Location"):
                response = client.get(short_url)
    except (httpx.TimeoutException, httpx.RequestError) as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=SHORT_LINK_ERROR_DETAIL,
        ) from exc

    location = response.headers.get("Location")
    if not location:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=SHORT_LINK_ERROR_DETAIL,
        )

    # Location 有可能是相对路径，这里统一拼成绝对 URL。
    return urljoin(short_url, location)


def should_resolve_to_long_url(parsed_url) -> bool:
    """
    判断当前 URL 是否应该先解析成标准长链接。

    当前需要先做解析的情况有两类：
    1. redd.it 这种短域名，本身虽然能提取出帖子 ID，但不适合作为长期落库 URL。
    2. /s/、share 等分享短链接，必须先还原出真正的 comments 长链接。
    """

    host = parsed_url.netloc.lower().split(":")[0]
    return (
        host == "redd.it"
        or host.endswith(".redd.it")
        or is_reddit_share_short_link(parsed_url)
    )


def build_canonical_reddit_post_url(parsed_url) -> str | None:
    """
    把一个已解析的 Reddit 帖子 URL 收敛成标准长链接。

    输出规则：
    1. 统一强制为 https://www.reddit.com 域名。
    2. 去掉 query 和 fragment，避免把 share_id、utm 参数永久存进数据库。
    3. 统一补上末尾斜杠，保证同一帖子长链接形式稳定。

    只要当前 URL 里已经能识别出 comments 路径，就能生成 canonical URL。
    """

    if REDDIT_COMMENTS_PATTERN.search(parsed_url.path) is None:
        return None

    normalized_path = parsed_url.path.rstrip("/")
    if not normalized_path:
        return None

    return f"https://www.reddit.com{normalized_path}/"


def parse_reddit_post_url(url: str) -> ParsedRedditPostURL:
    """
    解析 Reddit 帖子链接，返回 reddit_id 和 canonical 长链接。

    容错处理逻辑：
    1. 自动去掉首尾空格。
    2. 如果用户没写 http/https，则自动补一个 https:// 再解析。
    3. redd.it、/s/、share 等短链接先通过轻量级 HTTP 请求还原真实长链接。
    4. 标准长链接会被统一收敛成 canonical 长链接。
    5. 如果最终仍然无法匹配出帖子 ID，则返回明确错误。
    """

    normalized_url = normalize_reddit_url(url)
    get_reddit_host_or_raise(normalized_url)
    parsed_url = urlparse(normalized_url)

    candidate_url = normalized_url
    candidate_parsed_url = parsed_url

    # 对短域名和分享短链接，先轻量级还原出真实长链接。
    # 这样最终写入数据库的 url 就会稳定指向标准帖子详情页，
    # 后续监控抓取和截图抓取都能直接复用，不再受短链形式影响。
    if should_resolve_to_long_url(parsed_url):
        candidate_url = resolve_reddit_short_url(normalized_url)
        get_reddit_host_or_raise(candidate_url)
        candidate_parsed_url = urlparse(candidate_url)

    reddit_id = extract_reddit_id_from_parsed_url(candidate_parsed_url)
    if not reddit_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="无法从该链接中解析出 Reddit Post ID，请确认链接为标准帖子详情页。",
        )

    canonical_url = build_canonical_reddit_post_url(candidate_parsed_url)
    if not canonical_url:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="无法生成标准 Reddit 帖子长链接，请尝试直接输入帖子详情页地址。",
        )

    return ParsedRedditPostURL(
        reddit_id=reddit_id,
        canonical_url=canonical_url,
    )


def normalize_client_name(name: str) -> str:
    """
    统一生成客户名称的归一化键。

    当前规则保持最简单可控：
    1. 先 strip 去掉首尾空格。
    2. 再 lower 转成小写。

    这样可以解决最常见的：
    - Acme / acme
    - Client-A / client-a
    这类因为大小写差异导致的重复问题。
    """

    normalized_name = name.strip().lower()
    if not normalized_name:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="客户名称不能为空，请输入有效名称。",
        )
    return normalized_name


def get_client_or_404(db: Session, client_id: int) -> models.Client:
    """
    根据主键获取客户主数据。

    如果不存在，统一抛出 404，避免重复写相同异常逻辑。
    """

    client = db.query(models.Client).filter(models.Client.id == client_id).first()
    if not client:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"ID 为 {client_id} 的客户不存在。",
        )
    return client


def get_post_or_404(db: Session, post_id: int) -> models.Post:
    """
    根据主键获取帖子。

    这里额外做 joinedload，是为了让响应阶段能稳定拿到关联客户名，
    同时避免列表页或备注更新时出现不必要的 N+1 查询。
    """

    post = (
        db.query(models.Post)
        .options(joinedload(models.Post.client))
        .filter(models.Post.id == post_id)
        .first()
    )
    if not post:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"ID 为 {post_id} 的帖子不存在。",
        )
    return post


def get_clients(db: Session) -> list[models.Client]:
    """
    获取全部客户主数据。

    返回时按 normalized_name 排序，这样可以天然实现大小写无关的稳定排序。
    """

    return db.query(models.Client).order_by(models.Client.normalized_name.asc()).all()


def create_client(db: Session, client_in: schemas.ClientCreate) -> models.Client:
    """
    创建客户主数据。

    核心规则：
    1. 客户名称会先做 strip + lower 归一化。
    2. 归一化后的名称必须唯一，防止同一客户因大小写差异重复创建。
    """

    cleaned_name = client_in.name.strip()
    normalized_name = normalize_client_name(cleaned_name)

    existing_client = (
        db.query(models.Client)
        .filter(models.Client.normalized_name == normalized_name)
        .first()
    )
    if existing_client:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"客户“{cleaned_name}”已存在，请勿重复创建。",
        )

    db_client = models.Client(
        name=cleaned_name,
        normalized_name=normalized_name,
    )

    try:
        db.add(db_client)
        db.commit()
        db.refresh(db_client)
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"客户“{cleaned_name}”已存在，请勿重复创建。",
        ) from exc

    return db_client


def delete_client(db: Session, client_id: int) -> None:
    """
    删除客户主数据，并解绑历史帖子。

    本轮采用你确认过的业务规则：
    1. 允许删除已经被帖子使用过的客户。
    2. 删除前先把相关帖子统一改成 client_id = NULL。
    3. 前端会把这类帖子显示成“未分配客户”。
    """

    client = get_client_or_404(db, client_id)

    db.query(models.Post).filter(models.Post.client_id == client_id).update(
        {models.Post.client_id: None},
        synchronize_session=False,
    )
    db.delete(client)
    db.commit()


def create_post(db: Session, post_in: schemas.PostCreate) -> models.Post:
    """
    创建帖子登记记录。

    关键业务步骤：
    1. 从 URL 中自动提取 reddit_id，并生成 canonical 长链接。
    2. 根据 reddit_id 做唯一性查重。
    3. 根据 client_id 校验客户主数据存在。
    4. 若未重复，则写入 posts 表。
    """

    parsed_post_url = parse_reddit_post_url(post_in.url)
    reddit_id = parsed_post_url.reddit_id

    existing_post = (
        db.query(models.Post)
        .filter(models.Post.reddit_id == reddit_id)
        .first()
    )
    if existing_post:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"该帖子已登记，重复的 Reddit Post ID 为 {reddit_id}，"
                "请勿重复提交。"
            ),
        )

    client = get_client_or_404(db, post_in.client_id)

    db_post = models.Post(
        reddit_id=reddit_id,
        url=parsed_post_url.canonical_url,
        title=post_in.title.strip(),
        client_id=client.id,
        operator_note=post_in.operator_note,
    )

    try:
        db.add(db_post)
        db.commit()
        db.refresh(db_post)
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"该帖子已登记，重复的 Reddit Post ID 为 {reddit_id}，"
                "请勿重复提交。"
            ),
        ) from exc

    return get_post_or_404(db, db_post.id)


def get_posts(
    db: Session,
    client_id: int | None = None,
    unassigned: bool = False,
) -> list[models.Post]:
    """
    获取帖子列表。

    规则：
    1. 支持按 client_id 精确筛选。
    2. 支持按“未分配客户”筛选。
    3. 默认通过 joinedload 一次性带出客户主数据。
    4. 按 created_at 倒序返回，确保最新登记的帖子排在最前面。
    """

    query = db.query(models.Post).options(joinedload(models.Post.client))

    if unassigned:
        query = query.filter(models.Post.client_id.is_(None))
    elif client_id is not None:
        query = query.filter(models.Post.client_id == client_id)

    return query.order_by(models.Post.created_at.desc()).all()


def update_operator_note(
    db: Session,
    post_id: int,
    note_update: schemas.NoteUpdate,
) -> models.Post:
    """
    覆盖更新运营备注。

    这里不做“追加拼接”逻辑，严格遵循业务要求：
    后端只负责把前端传来的完整备注字符串原样覆盖到数据库中。
    """

    post = get_post_or_404(db, post_id)
    post.operator_note = note_update.operator_note

    db.commit()
    db.refresh(post)
    return get_post_or_404(db, post_id)


def get_post_tracking_data(db: Session, post_id: int) -> list[models.TrackingLog]:
    """
    获取某条帖子的全部追踪时间序列数据。

    返回规则：
    1. 若帖子不存在，返回 404。
    2. 若帖子存在但还没有任何追踪日志，返回空列表。
    3. 所有节点按 scraped_at 升序返回，方便前端直接画折线图。
    """

    _ = get_post_or_404(db, post_id)

    return (
        db.query(models.TrackingLog)
        .filter(models.TrackingLog.post_id == post_id)
        .order_by(models.TrackingLog.scraped_at.asc())
        .all()
    )


def get_post_screenshots(db: Session, post_id: int) -> list[models.ScreenshotLog]:
    """
    获取某条帖子的全部截图留存记录。

    返回规则：
    1. 若帖子不存在，返回 404。
    2. 若帖子存在但还没有任何截图，返回空列表。
    3. 所有截图按 day_mark 升序返回；若极端情况下出现相同 day_mark，
       再按 captured_at 升序兜底。
    """

    _ = get_post_or_404(db, post_id)

    return (
        db.query(models.ScreenshotLog)
        .filter(models.ScreenshotLog.post_id == post_id)
        .order_by(
            models.ScreenshotLog.day_mark.asc(),
            models.ScreenshotLog.captured_at.asc(),
        )
        .all()
    )
