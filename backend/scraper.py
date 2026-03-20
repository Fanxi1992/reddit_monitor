"""
Apify 抓取服务层。

这个文件负责整个“自动化追踪引擎”的抓取与落库部分：
1. 接收要追踪的帖子目标列表。
2. 按每批最多 30 个 URL 做切片，分批调用 Apify Actor。
3. 解析 Actor 返回的 Dataset。
4. 将 Removed 状态反写到 posts 表。
5. 将正常互动数据批量写入 tracking_logs 表。

重要说明：
1. ApifyClient 是同步客户端，会进行阻塞网络 I/O。
2. 为了不阻塞 FastAPI / APScheduler 的事件循环，这里提供了 async 包装函数，
   内部通过 asyncio.to_thread() 在线程池中执行同步抓取逻辑。
3. 抓取任务使用独立的 sessionmaker，避免和 Web 请求生命周期里的 Session 混用。
"""

from __future__ import annotations

import asyncio
from contextlib import contextmanager
from dataclasses import dataclass
from datetime import datetime, timezone
import logging
import os
from pathlib import Path
from typing import Iterator

from apify_client import ApifyClient
import httpx
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, sessionmaker

from backend import models
from backend.database import engine


# 当前固定使用的 Apify Reddit Scraper Actor ID。
ACTOR_ID = "oAuCIx3ItNrs2okjQ"

# 当前固定使用的 Apify 截图 Actor ID。
SCREENSHOT_ACTOR_ID = "rGCyoaKTKhyMiiTvS"

# 单次调用 Actor 时最多传入 30 个 URL，避免一个批次过大。
MAX_URLS_PER_BATCH = 30

# 本地截图存储目录。
PROJECT_ROOT = Path(__file__).resolve().parent.parent
STATIC_SCREENSHOTS_DIR = PROJECT_ROOT / "static" / "screenshots"

# 允许的截图业务天数。
# 业务定义调整为：
# - 第 0 天：发帖当天
# - 第 1 / 2 / 4 / 7 天：后续留存节点
SCREENSHOT_DAY_MARKS = {0, 1, 2, 4, 7}

logger = logging.getLogger(__name__)


# 为抓取任务单独创建一套 Session 工厂。
# 这样即使抓取逻辑运行在线程池中，也能确保每次任务用自己的数据库会话，
# 任务结束就关闭，避免 Session 泄露到全局状态。
ScraperSessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine,
)


@dataclass(frozen=True)
class ScrapeTarget:
    """
    单个待抓取帖子目标。

    这里不直接传 SQLAlchemy ORM 实体对象，而是传一个轻量不可变数据结构，
    避免 Session 关闭后 ORM 对象进入 detached 状态引发额外问题。
    """

    post_id: int
    reddit_id: str
    url: str


@contextmanager
def get_scraper_session() -> Iterator[Session]:
    """
    抓取任务专用数据库会话上下文。

    每次进入时新建 Session，退出时无论成功失败都安全关闭。
    """

    db = ScraperSessionLocal()
    try:
        yield db
    finally:
        db.close()


def ensure_screenshot_storage_dir() -> None:
    """
    确保本地截图目录存在。

    main.py 会在应用启动时提前创建，但这里仍然做一次兜底，
    避免未来在独立脚本或单元测试中直接调用截图逻辑时目录不存在。
    """

    STATIC_SCREENSHOTS_DIR.mkdir(parents=True, exist_ok=True)


def chunk_urls(urls: list[str], chunk_size: int = MAX_URLS_PER_BATCH) -> list[list[str]]:
    """
    把 URL 列表切成多个批次。

    例如 73 个 URL 会被切成：
    - 30
    - 30
    - 13
    """

    if chunk_size <= 0:
        raise ValueError("chunk_size 必须大于 0。")

    return [urls[index:index + chunk_size] for index in range(0, len(urls), chunk_size)]


def get_apify_client() -> ApifyClient:
    """
    创建 ApifyClient。

    APIFY_API_TOKEN 从 backend/.env 中读取。
    如果未配置，直接抛出明确异常，避免任务静默失败。
    """

    api_token = os.getenv("APIFY_API_TOKEN")
    if not api_token or api_token == "your_apify_api_token_here":
        raise ValueError(
            "未检测到有效的 APIFY_API_TOKEN，请先在 backend/.env 中完成配置。"
        )

    return ApifyClient(api_token)


def build_actor_input(url_batch: list[str]) -> dict:
    """
    构造单次 Actor 调用的输入参数。

    严格遵循你提供的要求，只传必要字段。
    """

    return {
        "startUrls": [{"url": url} for url in url_batch],
        "skipComments": True,
        "skipUserPosts": True,
        "skipCommunity": True,
        "includeNSFW": True,
        "proxy": {
            "useApifyProxy": True,
            "apifyProxyGroups": ["RESIDENTIAL"],
        },
    }


def build_screenshot_actor_input(url_batch: list[str]) -> dict:
    """
    构造单次截图 Actor 调用的输入参数。
    """
    return {
        "urls": [{"url": url} for url in url_batch],
        "format": "png",
        "waitUntil": "domcontentloaded",  # 改回 domcontentloaded，骨架出来就动手，不等那些乱七八糟的脚本
        "delay": 5000,                    # 缩短停留时间，防反爬
        "viewportWidth": 1280,
        "scrollToBottom": False,
        "waitUntilNetworkIdleAfterScroll": False,
        "proxy": {
            "useApifyProxy": True,
            "apifyProxyGroups": ["RESIDENTIAL"],  # 核心保命符！强制使用住宅代理，绕过 403
        },
        "selectorsToHide": "",
    }

def run_actor_for_url_batch(client: ApifyClient, url_batch: list[str]) -> list[dict]:
    """
    调用 Apify Actor，并取回该批次的全部 Dataset item。
    """

    run_input = build_actor_input(url_batch)
    run = client.actor(ACTOR_ID).call(run_input=run_input)

    dataset_id = run["defaultDatasetId"]
    return list(client.dataset(dataset_id).iterate_items())


def run_screenshot_actor_for_url_batch(
    client: ApifyClient,
    url_batch: list[str],
) -> list[dict]:
    """
    调用 Apify 截图 Actor，并取回该批次的全部 Dataset item。
    """

    run_input = build_screenshot_actor_input(url_batch)
    run = client.actor(SCREENSHOT_ACTOR_ID).call(run_input=run_input)

    dataset_id = run["defaultDatasetId"]
    return list(client.dataset(dataset_id).iterate_items())


def parse_scraped_at(scraped_at: str | None) -> datetime | None:
    """
    把 Apify 返回的 ISO 时间字符串转换成“UTC 无时区 datetime”。

    例如：
    2026-03-19T10:12:55.021Z

    统一转换为数据库当前使用的 UTC naive 时间风格，
    与 posts.created_at / tracking_logs.scraped_at 保持一致。
    """

    if not scraped_at:
        return None

    try:
        parsed_datetime = datetime.fromisoformat(scraped_at.replace("Z", "+00:00"))
    except ValueError:
        return None

    return parsed_datetime.astimezone(timezone.utc).replace(tzinfo=None)


def download_screenshot_binary(screenshot_url: str) -> bytes:
    """
    下载 Apify 返回的临时截图地址。

    注意：
    1. screenshotUrl 存在时效性，必须在拿到后尽快下载。
    2. 这里只接受真正的图片响应，避免错误页面被误存成本地 PNG。
    """

    response = httpx.get(
        screenshot_url,
        timeout=httpx.Timeout(20.0, connect=10.0),
        follow_redirects=True,
    )
    response.raise_for_status()

    content_type = response.headers.get("Content-Type", "").lower()
    if content_type and not content_type.startswith("image/"):
        raise ValueError(
            f"截图下载返回了非图片内容，Content-Type={content_type!r}。"
        )

    if not response.content:
        raise ValueError("截图下载结果为空。")

    return response.content


def save_screenshot_file(image_bytes: bytes, post_id: int, day_mark: int) -> str:
    """
    把截图二进制内容保存到本地服务器。

    返回值为数据库要保存的相对路径，统一使用正斜杠风格，
    方便后续直接拼接成 /static/... 的访问地址。
    """

    ensure_screenshot_storage_dir()

    timestamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%S%fZ")
    file_name = f"post_{post_id}_day_{day_mark}_{timestamp}.png"
    absolute_path = STATIC_SCREENSHOTS_DIR / file_name
    absolute_path.write_bytes(image_bytes)

    relative_path = Path("static") / "screenshots" / file_name
    return relative_path.as_posix()


def delete_local_screenshot_file(relative_path: str) -> None:
    """
    删除本地截图文件。

    这个函数主要用于数据库提交失败时做兜底清理，避免留下孤儿文件。
    """

    absolute_path = PROJECT_ROOT / Path(relative_path)
    if absolute_path.exists():
        absolute_path.unlink()


def persist_scraped_items(items: list[dict], target_map: dict[str, ScrapeTarget]) -> dict:
    """
    解析并落库单批次抓取结果。

    业务规则：
    1. parsedId 对应数据库中的 reddit_id。
    2. body == "[removed]" 时，将 posts.status 改为 Removed。
    3. 非 removed 的 item，才写入 tracking_logs。
    4. 采用批量插入 tracking_logs，降低数据库往返次数。
    """

    inserted_logs = 0
    removed_posts = 0
    skipped_items = 0

    # 先提取当前批次中所有可识别的 reddit_id，减少数据库查询范围。
    reddit_ids = [
        str(item.get("parsedId")).lower()
        for item in items
        if item.get("parsedId")
    ]

    if not reddit_ids:
        return {
            "inserted_logs": 0,
            "removed_posts": 0,
            "skipped_items": len(items),
        }

    with get_scraper_session() as db:
        db_posts = (
            db.query(models.Post)
            .filter(models.Post.reddit_id.in_(reddit_ids))
            .all()
        )
        posts_by_reddit_id = {post.reddit_id: post for post in db_posts}

        tracking_logs_to_insert: list[models.TrackingLog] = []

        for item in items:
            reddit_id = item.get("parsedId")
            if not reddit_id:
                skipped_items += 1
                continue

            reddit_id = str(reddit_id).lower()
            post = posts_by_reddit_id.get(reddit_id)
            target = target_map.get(reddit_id)

            # 如果返回结果中的 parsedId 不在当前任务目标里，直接跳过。
            if not post or not target:
                skipped_items += 1
                continue

            # 若正文被删，则反写帖子状态。
            if item.get("body") == "[removed]":
                if post.status != "Removed":
                    post.status = "Removed"
                    removed_posts += 1
                continue

            scraped_at = parse_scraped_at(item.get("scrapedAt"))
            if not scraped_at:
                skipped_items += 1
                continue

            tracking_logs_to_insert.append(
                models.TrackingLog(
                    post_id=post.id,
                    upvotes=int(item.get("upVotes") or 0),
                    comments=int(item.get("numberOfComments") or 0),
                    scraped_at=scraped_at,
                )
            )

        if tracking_logs_to_insert:
            # 这里使用 bulk_save_objects 批量插入，适合日志类高频写入场景。
            db.bulk_save_objects(tracking_logs_to_insert)
            inserted_logs = len(tracking_logs_to_insert)

        db.commit()

    return {
        "inserted_logs": inserted_logs,
        "removed_posts": removed_posts,
        "skipped_items": skipped_items,
    }


def persist_screenshot_items(
    items: list[dict],
    batch_targets_with_days: list[tuple[ScrapeTarget, int]],
) -> dict:
    """
    解析并落库单批次截图结果。

    业务规则：
    1. 通过 item.startUrl 和 target.url 的完全匹配认领结果。
    2. screenshotUrl 一旦拿到，立即下载到本地 static/screenshots/。
    3. 数据库只保存本地相对路径，不保存 Apify 临时链接。
    4. 同一条帖子在同一 day_mark 只保留一张成功截图。
    """

    inserted_screenshots = 0
    skipped_items = 0
    failed_downloads = 0

    if not batch_targets_with_days:
        return {
            "inserted_screenshots": 0,
            "skipped_items": len(items),
            "failed_downloads": 0,
        }

    targets_by_url = {
        target.url: (target, day_mark)
        for target, day_mark in batch_targets_with_days
    }

    candidate_post_ids = [target.post_id for target, _ in batch_targets_with_days]
    candidate_day_marks = list({day_mark for _, day_mark in batch_targets_with_days})

    with get_scraper_session() as db:
        existing_logs = (
            db.query(models.ScreenshotLog.post_id, models.ScreenshotLog.day_mark)
            .filter(models.ScreenshotLog.post_id.in_(candidate_post_ids))
            .filter(models.ScreenshotLog.day_mark.in_(candidate_day_marks))
            .all()
        )
        existing_keys = {
            (post_id, day_mark)
            for post_id, day_mark in existing_logs
        }

        screenshot_logs_to_insert: list[models.ScreenshotLog] = []
        written_file_paths: list[str] = []

        for item in items:
            start_url = item.get("startUrl")
            if not start_url:
                skipped_items += 1
                logger.warning("截图结果缺少 startUrl，已跳过该 item。")
                continue

            matched_target = targets_by_url.get(str(start_url))
            if not matched_target:
                skipped_items += 1
                logger.warning("截图结果未匹配到目标 startUrl=%s，已跳过。", start_url)
                continue

            target, day_mark = matched_target
            dedupe_key = (target.post_id, day_mark)
            if dedupe_key in existing_keys:
                skipped_items += 1
                logger.info(
                    "帖子 %s 在第 %s 天已有成功截图，本次跳过重复保存。",
                    target.post_id,
                    day_mark,
                )
                continue

            screenshot_url = item.get("screenshotUrl")
            if not screenshot_url:
                skipped_items += 1
                logger.warning(
                    "帖子 %s 第 %s 天截图结果缺少 screenshotUrl，已跳过。",
                    target.post_id,
                    day_mark,
                )
                continue

            try:
                image_bytes = download_screenshot_binary(str(screenshot_url))
                file_path = save_screenshot_file(
                    image_bytes=image_bytes,
                    post_id=target.post_id,
                    day_mark=day_mark,
                )
            except Exception as exc:  # noqa: BLE001 - 这里希望稳住整批任务
                failed_downloads += 1
                logger.warning(
                    "帖子 %s 第 %s 天截图下载或保存失败：%s",
                    target.post_id,
                    day_mark,
                    exc,
                )
                continue

            screenshot_logs_to_insert.append(
                models.ScreenshotLog(
                    post_id=target.post_id,
                    day_mark=day_mark,
                    file_path=file_path,
                )
            )
            written_file_paths.append(file_path)
            existing_keys.add(dedupe_key)

        if screenshot_logs_to_insert:
            try:
                db.add_all(screenshot_logs_to_insert)
                db.commit()
                inserted_screenshots = len(screenshot_logs_to_insert)
            except IntegrityError as exc:
                db.rollback()
                for file_path in written_file_paths:
                    delete_local_screenshot_file(file_path)
                logger.warning("截图记录落库失败，已回滚并清理本地文件：%s", exc)
        else:
            db.rollback()

    return {
        "inserted_screenshots": inserted_screenshots,
        "skipped_items": skipped_items,
        "failed_downloads": failed_downloads,
    }


def scrape_posts(targets: list[ScrapeTarget]) -> dict:
    """
    同步执行抓取任务。

    执行流程：
    1. 提取全部 URL。
    2. 按 30 条一组分批。
    3. 每批调用一次 Actor。
    4. 每批解析并落库。
    5. 汇总最终统计结果。
    """

    if not targets:
        return {
            "target_count": 0,
            "batch_count": 0,
            "inserted_logs": 0,
            "removed_posts": 0,
            "skipped_items": 0,
        }

    client = get_apify_client()
    url_list = [target.url for target in targets]
    url_batches = chunk_urls(url_list, chunk_size=MAX_URLS_PER_BATCH)

    # 以 reddit_id 为键保存目标映射，方便根据 Apify 返回的 parsedId 快速定位帖子。
    target_map = {target.reddit_id.lower(): target for target in targets}

    summary = {
        "target_count": len(targets),
        "batch_count": len(url_batches),
        "inserted_logs": 0,
        "removed_posts": 0,
        "skipped_items": 0,
    }

    for url_batch in url_batches:
        items = run_actor_for_url_batch(client, url_batch)
        batch_result = persist_scraped_items(items, target_map)

        summary["inserted_logs"] += batch_result["inserted_logs"]
        summary["removed_posts"] += batch_result["removed_posts"]
        summary["skipped_items"] += batch_result["skipped_items"]

    return summary


def scrape_and_download_screenshots(
    targets_with_days: list[tuple[ScrapeTarget, int]],
) -> dict:
    """
    同步执行截图抓取与本地下载任务。

    执行流程：
    1. 提取全部目标 URL。
    2. 按 30 条一组分批。
    3. 每批调用一次截图 Actor。
    4. 每批把截图下载到本地并落库。
    5. 汇总最终统计结果。
    """

    if not targets_with_days:
        return {
            "target_count": 0,
            "batch_count": 0,
            "inserted_screenshots": 0,
            "skipped_items": 0,
            "failed_downloads": 0,
        }

    client = get_apify_client()
    url_list = [target.url for target, _ in targets_with_days]
    url_batches = chunk_urls(url_list, chunk_size=MAX_URLS_PER_BATCH)

    summary = {
        "target_count": len(targets_with_days),
        "batch_count": len(url_batches),
        "inserted_screenshots": 0,
        "skipped_items": 0,
        "failed_downloads": 0,
    }

    for batch_index, url_batch in enumerate(url_batches):
        start_index = batch_index * MAX_URLS_PER_BATCH
        end_index = start_index + len(url_batch)
        batch_targets_with_days = targets_with_days[start_index:end_index]

        items = run_screenshot_actor_for_url_batch(client, url_batch)
        batch_result = persist_screenshot_items(items, batch_targets_with_days)

        summary["inserted_screenshots"] += batch_result["inserted_screenshots"]
        summary["skipped_items"] += batch_result["skipped_items"]
        summary["failed_downloads"] += batch_result["failed_downloads"]

    return summary


async def scrape_posts_async(targets: list[ScrapeTarget]) -> dict:
    """
    异步包装版本。

    由于 ApifyClient 是同步阻塞客户端，这里把真正的抓取过程丢进线程池执行，
    避免把 FastAPI 主事件循环和 APScheduler 的异步调度线程堵住。
    """

    return await asyncio.to_thread(scrape_posts, targets)


async def scrape_and_download_screenshots_async(
    targets_with_days: list[tuple[ScrapeTarget, int]],
) -> dict:
    """
    截图抓取任务的异步包装版本。

    由于 ApifyClient 和图片下载都是同步阻塞 I/O，
    这里同样通过 asyncio.to_thread() 丢进线程池执行。
    """

    return await asyncio.to_thread(
        scrape_and_download_screenshots,
        targets_with_days,
    )
