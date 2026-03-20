"""
定时调度器模块。

这个文件负责：
1. 根据业务窗口从数据库中筛选需要追踪的帖子。
2. 按既定策略触发抓取任务。
3. 用 AsyncIOScheduler 把任务挂到 FastAPI 生命周期中。

调度策略：
1. 全面巡检：过去 7 天内、且未 Removed 的帖子，每天 06:00 执行一次。
2. 高频巡检：过去 48 小时内、且未 Removed 的帖子，每天 00:00 / 12:00 / 18:00 执行。

特别注意：
1. 调度器时区必须使用 Asia/Shanghai。
2. 但数据库中的 created_at 是 UTC naive 时间，所以筛选时仍然要按 UTC 计算窗口。
3. 调度器查询数据库时使用独立 sessionmaker，避免和 Web 请求会话或抓取线程会话混用。
"""

from __future__ import annotations

import asyncio
from contextlib import contextmanager
from datetime import datetime, timedelta, timezone
from typing import Iterator
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from sqlalchemy.orm import Session, sessionmaker

from backend import models
from backend.database import engine
from backend.scraper import (
    SCREENSHOT_DAY_MARKS,
    ScrapeTarget,
    scrape_and_download_screenshots_async,
    scrape_posts_async,
)


try:
    SHANGHAI_TIMEZONE = ZoneInfo("Asia/Shanghai")
except ZoneInfoNotFoundError as exc:
    raise RuntimeError(
        "未找到 Asia/Shanghai 时区数据，请先安装 tzdata 依赖。"
    ) from exc


# 调度器专用 Session 工厂。
# 作用和 scraper.py 中的 ScraperSessionLocal 类似：
# 每次任务查询都创建独立会话，结束立刻关闭。
SchedulerSessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine,
)


_scheduler: AsyncIOScheduler | None = None


@contextmanager
def get_scheduler_session() -> Iterator[Session]:
    """
    调度器专用数据库会话上下文。
    """

    db = SchedulerSessionLocal()
    try:
        yield db
    finally:
        db.close()


def utc_now_naive() -> datetime:
    """
    返回当前 UTC 无时区时间。

    用于和数据库中 created_at 的存储风格保持一致。
    """

    return datetime.now(timezone.utc).replace(tzinfo=None)


def load_active_targets_since(cutoff_datetime: datetime) -> list[ScrapeTarget]:
    """
    从数据库中加载某个时间窗口内、且尚未 Removed 的帖子目标。
    """

    with get_scheduler_session() as db:
        posts = (
            db.query(models.Post)
            .filter(models.Post.created_at >= cutoff_datetime)
            .filter(models.Post.status != "Removed")
            .order_by(models.Post.created_at.desc())
            .all()
        )

        return [
            ScrapeTarget(
                post_id=post.id,
                reddit_id=post.reddit_id,
                url=post.url,
            )
            for post in posts
        ]


def load_screenshot_targets() -> list[tuple[ScrapeTarget, int]]:
    """
    加载今天需要执行截图留存的帖子目标。

    规则：
    1. 仅处理当前状态仍为 Active 的帖子。
    2. 根据当前 UTC 时间与 created_at 的整数天差计算 day_mark。
    3. 只选择第 0 / 1 / 2 / 4 / 7 天的帖子。
    4. 如果同一个 post_id + day_mark 已有成功截图，则本轮直接跳过。
    """

    current_utc_naive = utc_now_naive()

    with get_scheduler_session() as db:
        posts = (
            db.query(models.Post)
            .filter(models.Post.status == "Active")
            .order_by(models.Post.created_at.desc())
            .all()
        )

        candidate_targets: list[tuple[models.Post, int]] = []
        candidate_post_ids: list[int] = []

        for post in posts:
            if post.created_at > current_utc_naive:
                continue

            day_mark = (current_utc_naive - post.created_at).days
            if day_mark not in SCREENSHOT_DAY_MARKS:
                continue

            candidate_targets.append((post, day_mark))
            candidate_post_ids.append(post.id)

        if not candidate_targets:
            return []

        existing_logs = (
            db.query(models.ScreenshotLog.post_id, models.ScreenshotLog.day_mark)
            .filter(models.ScreenshotLog.post_id.in_(candidate_post_ids))
            .filter(models.ScreenshotLog.day_mark.in_(list(SCREENSHOT_DAY_MARKS)))
            .all()
        )
        existing_keys = {
            (post_id, day_mark)
            for post_id, day_mark in existing_logs
        }

        return [
            (
                ScrapeTarget(
                    post_id=post.id,
                    reddit_id=post.reddit_id,
                    url=post.url,
                ),
                day_mark,
            )
            for post, day_mark in candidate_targets
            if (post.id, day_mark) not in existing_keys
        ]


async def run_full_inspection() -> dict:
    """
    策略 A：全面巡检。

    选择过去 7 天内、状态仍然不是 Removed 的帖子。
    """

    cutoff_datetime = utc_now_naive() - timedelta(days=7)
    targets = await asyncio.to_thread(load_active_targets_since, cutoff_datetime)
    return await scrape_posts_async(targets)


async def run_high_frequency_inspection() -> dict:
    """
    策略 B：高频巡检。

    选择过去 48 小时内、状态仍然不是 Removed 的帖子。
    """

    cutoff_datetime = utc_now_naive() - timedelta(hours=48)
    targets = await asyncio.to_thread(load_active_targets_since, cutoff_datetime)
    return await scrape_posts_async(targets)


async def run_screenshot_capture() -> dict:
    """
    截图留存巡检任务。

    每天固定巡检一次，命中第 0 / 1 / 2 / 4 / 7 天窗口的 Active 帖子
    会被送入截图 Actor，并在成功后立刻把图片下载到本地。
    """

    targets_with_days = await asyncio.to_thread(load_screenshot_targets)
    return await scrape_and_download_screenshots_async(targets_with_days)


def get_scheduler() -> AsyncIOScheduler:
    """
    获取全局调度器实例。

    使用单例模式，避免 FastAPI 热重载或多次导入时重复注册任务。
    """

    global _scheduler

    if _scheduler is None:
        _scheduler = AsyncIOScheduler(timezone=SHANGHAI_TIMEZONE)

        # 每天 06:00 执行全面巡检。
        _scheduler.add_job(
            run_full_inspection,
            trigger="cron",
            id="daily_full_inspection",
            hour=6,
            minute=0,
            replace_existing=True,
            coalesce=True,
            max_instances=1,
            misfire_grace_time=3600,
        )

        # 每天 00:00 / 12:00 / 18:00 执行高频巡检。
        _scheduler.add_job(
            run_high_frequency_inspection,
            trigger="cron",
            id="high_frequency_inspection",
            hour="0,12,18",
            minute=0,
            replace_existing=True,
            coalesce=True,
            max_instances=1,
            misfire_grace_time=3600,
        )

        # 每天 08:00 执行截图留存巡检。
        _scheduler.add_job(
            run_screenshot_capture,
            trigger="cron",
            id="daily_screenshot_capture",
            hour=7,
            minute=30,
            replace_existing=True,
            coalesce=True,
            max_instances=1,
            misfire_grace_time=3600,
        )

    return _scheduler


def start_scheduler() -> AsyncIOScheduler:
    """
    启动调度器。
    """

    scheduler = get_scheduler()
    if not scheduler.running:
        scheduler.start()
    return scheduler


def shutdown_scheduler() -> None:
    """
    优雅关闭调度器。

    wait=True 表示如果当前恰好有任务正在执行，则等待它完成后再退出。
    """

    global _scheduler

    if _scheduler and _scheduler.running:
        _scheduler.shutdown(wait=True)
