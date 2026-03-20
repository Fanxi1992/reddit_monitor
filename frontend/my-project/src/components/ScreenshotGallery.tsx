import { ExternalLink, ImageIcon } from 'lucide-react'

import {
  buildBackendAssetUrl,
  type ScreenshotResponse,
} from '../api/client'

interface ScreenshotGalleryProps {
  screenshots: ScreenshotResponse[]
}

function formatDateTime(dateString: string) {
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(dateString))
}

export default function ScreenshotGallery({
  screenshots,
}: ScreenshotGalleryProps) {
  const sortedScreenshots = [...screenshots].sort((left, right) => {
    if (left.day_mark !== right.day_mark) {
      return left.day_mark - right.day_mark
    }

    return new Date(left.captured_at).getTime() - new Date(right.captured_at).getTime()
  })

  if (sortedScreenshots.length === 0) {
    return (
      <div className="flex min-h-[320px] flex-col items-center justify-center rounded-[28px] border border-dashed border-slate-300 bg-slate-50/70 px-6 text-center">
        <div className="rounded-full bg-slate-200/80 p-4 text-slate-500">
          <ImageIcon className="h-7 w-7" />
        </div>
        <h4 className="mt-5 text-lg font-semibold text-slate-900">当前还没有可展示的截图</h4>
        <p className="mt-2 max-w-xl text-sm leading-6 text-slate-500">
          如果帖子刚录入不久，可能还没有跑到第 0 / 1 / 2 / 4 / 7 天截图窗口；也可能本轮截图任务尚未执行。
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {sortedScreenshots.map((screenshot) => {
        const imageUrl = buildBackendAssetUrl(screenshot.file_path)

        return (
          <section
            key={screenshot.id}
            className="overflow-hidden rounded-[30px] border border-slate-200 bg-white shadow-[0_18px_60px_rgba(148,163,184,0.12)]"
          >
            <div className="flex flex-col gap-4 border-b border-slate-200/80 bg-[linear-gradient(180deg,rgba(255,247,237,0.92)_0%,rgba(255,255,255,0.9)_100%)] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs font-medium uppercase tracking-[0.24em] text-orange-700/80">
                  Screenshot Archive
                </p>
                <h4 className="mt-2 text-lg font-bold text-slate-900">
                  第 {screenshot.day_mark} 天留存截图
                </h4>
                <p className="mt-1 text-sm text-slate-500">
                  截图时间：{formatDateTime(screenshot.captured_at)}
                </p>
              </div>

              <a
                href={imageUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:border-orange-200 hover:text-orange-700"
              >
                <ExternalLink className="h-4 w-4" />
                新标签查看原图
              </a>
            </div>

            <div className="bg-[linear-gradient(180deg,rgba(248,250,252,0.86)_0%,rgba(255,255,255,0.98)_100%)] p-5">
              <div className="overflow-hidden rounded-[26px] border border-slate-200 bg-slate-100/70 p-3">
                <img
                  src={imageUrl}
                  alt={`第 ${screenshot.day_mark} 天截图留存`}
                  className="w-full object-contain"
                  loading="lazy"
                />
              </div>
            </div>
          </section>
        )
      })}
    </div>
  )
}
