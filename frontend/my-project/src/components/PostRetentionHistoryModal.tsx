import { ImageIcon, LoaderCircle } from 'lucide-react'

import {
  buildBackendAssetUrl,
  type PostRetentionHistoryResponse,
} from '../api/client'
import Modal from './Modal'

function toUtcDate(dateString: string) {
  const normalizedDateString =
    dateString.endsWith('Z') || /[+-]\d{2}:\d{2}$/.test(dateString)
      ? dateString
      : `${dateString}Z`

  return new Date(normalizedDateString)
}

function formatDate(dateString: string) {
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(toUtcDate(dateString))
}

interface PostRetentionHistoryModalProps {
  open: boolean
  title: string
  isLoading: boolean
  errorMessage: string
  history: PostRetentionHistoryResponse | null
  onClose: () => void
}

export default function PostRetentionHistoryModal({
  open,
  title,
  isLoading,
  errorMessage,
  history,
  onClose,
}: PostRetentionHistoryModalProps) {
  return (
    <Modal
      open={open}
      title="截图历史记录"
      description={title}
      onClose={onClose}
      maxWidthClassName="max-w-6xl"
    >
      {isLoading ? (
        <div className="flex min-h-[360px] items-center justify-center gap-3 text-slate-500">
          <LoaderCircle className="h-5 w-5 animate-spin" />
          正在加载截图历史...
        </div>
      ) : errorMessage ? (
        <div className="space-y-6">
          <div className="flex min-h-[320px] items-center justify-center text-center text-sm leading-7 text-red-600">
            {errorMessage}
          </div>

          <div className="flex justify-end">
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-11 items-center justify-center rounded-xl bg-slate-700 px-5 text-sm font-medium text-white transition hover:bg-slate-800"
            >
              关闭
            </button>
          </div>
        </div>
      ) : history === null || history.screenshots.length === 0 ? (
        <div className="space-y-6">
          <div className="flex min-h-[320px] flex-col items-center justify-center rounded-[28px] border border-dashed border-slate-300 bg-slate-50/70 px-6 text-center">
            <div className="rounded-full bg-slate-200/80 p-4 text-slate-500">
              <ImageIcon className="h-7 w-7" />
            </div>
            <h4 className="mt-5 text-lg font-semibold text-slate-900">当前还没有成功截图</h4>
            <p className="mt-2 max-w-xl text-sm leading-6 text-slate-500">
              这条帖子暂时还没有成功落库的截图记录。可能尚未命中截图窗口，也可能本轮截图任务未成功。
            </p>
          </div>

          <div className="flex justify-end">
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-11 items-center justify-center rounded-xl bg-slate-700 px-5 text-sm font-medium text-white transition hover:bg-slate-800"
            >
              关闭
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {history.screenshots.map((screenshot) => {
            const imageUrl = buildBackendAssetUrl(screenshot.file_path)

            return (
              <section
                key={screenshot.id}
                className="overflow-hidden rounded-[24px] border border-slate-200 bg-white"
              >
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-slate-50/80 px-5 py-4">
                  <div className="flex flex-wrap items-center gap-3 text-slate-900">
                    <div className="flex items-center gap-2">
                      <span className="inline-block h-3 w-3 rounded-full bg-emerald-500" />
                      <span className="text-lg font-medium">第 {screenshot.day_mark} 天</span>
                    </div>
                    <span className="text-lg text-slate-500">{formatDate(screenshot.captured_at)}</span>
                  </div>

                  <span className="inline-flex rounded-full bg-emerald-100 px-3 py-1 text-sm font-medium text-emerald-700">
                    截图成功
                  </span>
                </div>

                <div className="bg-[linear-gradient(180deg,rgba(248,250,252,0.86)_0%,rgba(255,255,255,0.98)_100%)] p-5">
                  <div className="overflow-hidden rounded-[20px] border border-slate-200 bg-slate-100/70 p-3">
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

          <div className="flex justify-end">
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-11 items-center justify-center rounded-xl bg-slate-700 px-5 text-sm font-medium text-white transition hover:bg-slate-800"
            >
              关闭
            </button>
          </div>
        </div>
      )}
    </Modal>
  )
}
