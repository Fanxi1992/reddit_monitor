import { Camera, ExternalLink, ImageIcon, LoaderCircle } from 'lucide-react'

import type { PostRetentionRowResponse } from '../api/client'

function toUtcDate(dateString: string) {
  const normalizedDateString =
    dateString.endsWith('Z') || /[+-]\d{2}:\d{2}$/.test(dateString)
      ? dateString
      : `${dateString}Z`

  return new Date(normalizedDateString)
}

function formatDateTime(dateString: string) {
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(toUtcDate(dateString))
}

interface PostRetentionTableProps {
  rows: PostRetentionRowResponse[]
  isLoading: boolean
  onOpenHistory: (row: PostRetentionRowResponse) => void
}

export default function PostRetentionTable({
  rows,
  isLoading,
  onOpenHistory,
}: PostRetentionTableProps) {
  if (isLoading) {
    return (
      <div className="flex min-h-[260px] items-center justify-center gap-2 text-sm text-slate-500">
        <LoaderCircle className="h-4 w-4 animate-spin" />
        正在加载帖子留存列表...
      </div>
    )
  }

  if (rows.length === 0) {
    return (
      <div className="flex min-h-[220px] items-center justify-center border-t border-slate-200 px-6 text-sm text-slate-500">
        当前没有符合条件的留存记录。
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-[1240px] w-full table-fixed border-collapse text-sm text-slate-700">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50/70 text-left text-xs uppercase tracking-[0.14em] text-slate-500">
            <th className="w-[118px] px-4 py-3 font-semibold">状态</th>
            <th className="w-[90px] px-3 py-3 font-semibold">类型</th>
            <th className="w-[150px] px-3 py-3 font-semibold">客户</th>
            <th className="w-[340px] px-4 py-3 font-semibold">标题</th>
            <th className="w-[330px] px-4 py-3 font-semibold">链接</th>
            <th className="w-[160px] px-3 py-3 font-semibold">创建时间</th>
            <th className="w-[132px] px-3 py-3 font-semibold">截图</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const isRemoved = row.status === 'Removed'
            const statusText =
              row.latest_screenshot_day_mark === null
                ? '暂无'
                : `第 ${row.latest_screenshot_day_mark} 天`

            return (
              <tr
                key={row.id}
                className="border-b border-slate-200 last:border-b-0 hover:bg-slate-50/60"
              >
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2 text-slate-900">
                    <span
                      className={[
                        'inline-block h-3 w-3 rounded-full',
                        isRemoved ? 'bg-red-500' : 'bg-emerald-500',
                      ].join(' ')}
                      title={isRemoved ? '被Ban' : '正常'}
                    />
                    <span className="font-medium">{statusText}</span>
                  </div>
                </td>
                <td className="px-3 py-3">
                  <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
                    {row.post_type}
                  </span>
                </td>
                <td className="px-3 py-3 text-slate-900" title={row.client_name ?? '未分配客户'}>
                  <div className="truncate">{row.client_name ?? '未分配客户'}</div>
                </td>
                <td className="px-4 py-3 text-slate-900" title={row.title}>
                  <div className="truncate font-medium">{row.title}</div>
                </td>
                <td className="px-4 py-3">
                  <a
                    href={row.url}
                    target="_blank"
                    rel="noreferrer"
                    title={row.url}
                    className="inline-flex max-w-full items-center gap-1 text-blue-600 transition hover:text-blue-700"
                  >
                    <span className="truncate">{row.url}</span>
                    <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                  </a>
                </td>
                <td className="px-3 py-3 text-slate-600">{formatDateTime(row.created_at)}</td>
                <td className="px-3 py-3">
                  <button
                    type="button"
                    onClick={() => onOpenHistory(row)}
                    className="inline-flex items-center gap-1 rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-blue-700"
                  >
                    {row.screenshot_count > 0 ? (
                      <Camera className="h-3.5 w-3.5" />
                    ) : (
                      <ImageIcon className="h-3.5 w-3.5" />
                    )}
                    查看 ({row.screenshot_count})
                  </button>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
