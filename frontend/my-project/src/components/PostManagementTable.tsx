import { Archive, Copy, LoaderCircle, MessageCircle, ThumbsUp } from 'lucide-react'

import type { PostResponse } from '../api/client'

const numberFormatter = new Intl.NumberFormat('en-US')

function toUtcDate(dateString: string) {
  const normalizedDateString =
    dateString.endsWith('Z') || /[+-]\d{2}:\d{2}$/.test(dateString)
      ? dateString
      : `${dateString}Z`

  return new Date(normalizedDateString)
}

function formatDateTime(dateString: string | null) {
  if (!dateString) {
    return '--'
  }

  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(toUtcDate(dateString))
}

function formatNotePrefix(dateString: string | null) {
  if (!dateString) {
    return ''
  }

  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
    .format(toUtcDate(dateString))
    .replace(/\//g, '/')
}

function truncateText(text: string, maxLength: number) {
  const characters = Array.from(text)
  if (characters.length <= maxLength) {
    return text
  }

  return `${characters.slice(0, maxLength).join('')}...`
}

function formatNotePreview(post: PostResponse) {
  if (!post.operator_note) {
    return '--'
  }

  const prefix = post.operator_note_updated_at
    ? `[${formatNotePrefix(post.operator_note_updated_at)}] `
    : ''

  return truncateText(`${prefix}${post.operator_note}`, 40)
}

function formatMetric(value: number | null) {
  if (value === null) {
    return '--'
  }

  return numberFormatter.format(value)
}

interface PostManagementTableProps {
  posts: PostResponse[]
  isLoading: boolean
  onCopyLink: (post: PostResponse) => Promise<void> | void
  onEditNote: (post: PostResponse) => void
  onArchive: (post: PostResponse) => void
}

export default function PostManagementTable({
  posts,
  isLoading,
  onCopyLink,
  onEditNote,
  onArchive,
}: PostManagementTableProps) {
  if (isLoading) {
    return (
      <div className="flex min-h-[240px] items-center justify-center gap-2 text-sm text-slate-500">
        <LoaderCircle className="h-4 w-4 animate-spin" />
        正在加载帖子列表...
      </div>
    )
  }

  if (posts.length === 0) {
    return (
      <div className="flex min-h-[220px] items-center justify-center border-t border-slate-200 px-6 text-sm text-slate-500">
        当前没有符合条件的帖子。
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-[1220px] w-full table-fixed border-collapse text-sm text-slate-700">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50/70 text-left text-xs uppercase tracking-[0.14em] text-slate-500">
            <th className="w-[84px] px-4 py-3 font-semibold">状态</th>
            <th className="w-[94px] px-3 py-3 font-semibold">类型</th>
            <th className="w-[180px] px-3 py-3 font-semibold">客户</th>
            <th className="w-[320px] px-3 py-3 font-semibold">标题</th>
            <th className="w-[108px] px-3 py-3 font-semibold">链接</th>
            <th className="w-[92px] px-3 py-3 font-semibold">点赞</th>
            <th className="w-[92px] px-3 py-3 font-semibold">评论</th>
            <th className="w-[260px] px-3 py-3 font-semibold">运营备注</th>
            <th className="w-[150px] px-3 py-3 font-semibold">创建时间</th>
            <th className="w-[150px] px-3 py-3 font-semibold">最近更新</th>
            <th className="w-[104px] px-3 py-3 font-semibold">操作</th>
          </tr>
        </thead>
        <tbody>
          {posts.map((post) => {
            const isRemoved = post.status === 'Removed'

            return (
              <tr
                key={post.id}
                className="border-b border-slate-200 last:border-b-0 hover:bg-slate-50/60"
              >
                <td className="px-4 py-3">
                  <span
                    className={[
                      'inline-block h-3 w-3 rounded-full',
                      isRemoved ? 'bg-red-500' : 'bg-emerald-500',
                    ].join(' ')}
                    title={isRemoved ? 'Ban' : 'Normal'}
                  />
                </td>
                <td className="px-3 py-3 font-medium text-slate-900">{post.post_type}</td>
                <td className="px-3 py-3 text-slate-900" title={post.client_name ?? '未分配客户'}>
                  <div className="truncate">{post.client_name ?? '未分配客户'}</div>
                </td>
                <td className="px-3 py-3 text-slate-900" title={post.title}>
                  <div className="truncate">{post.title}</div>
                </td>
                <td className="px-3 py-3">
                  <button
                    type="button"
                    onClick={() => void onCopyLink(post)}
                    className="inline-flex items-center gap-1 rounded-md border border-blue-100 bg-blue-50 px-2.5 py-1.5 text-xs font-medium text-blue-700 transition hover:bg-blue-100"
                  >
                    <Copy className="h-3.5 w-3.5" />
                    复制
                  </button>
                </td>
                <td className="px-3 py-3">
                  <div className="inline-flex items-center gap-1 font-semibold text-slate-900">
                    <ThumbsUp className="h-4 w-4 text-slate-400" />
                    {formatMetric(post.latest_upvotes)}
                  </div>
                </td>
                <td className="px-3 py-3">
                  <div className="inline-flex items-center gap-1 font-semibold text-slate-900">
                    <MessageCircle className="h-4 w-4 text-slate-400" />
                    {formatMetric(post.latest_comments)}
                  </div>
                </td>
                <td className="px-3 py-3">
                  <button
                    type="button"
                    onClick={() => onEditNote(post)}
                    className={[
                      'w-full text-left text-sm transition hover:text-blue-700',
                      post.operator_note ? 'text-slate-700' : 'text-slate-400',
                    ].join(' ')}
                    title={post.operator_note ?? '点击填写备注'}
                  >
                    <span className="block truncate">{formatNotePreview(post)}</span>
                  </button>
                </td>
                <td className="px-3 py-3 text-slate-600">{formatDateTime(post.created_at)}</td>
                <td className="px-3 py-3 text-slate-600">{formatDateTime(post.last_scraped_at)}</td>
                <td className="px-3 py-3">
                  <button
                    type="button"
                    onClick={() => onArchive(post)}
                    className="inline-flex items-center gap-1 rounded-md border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-xs font-medium text-amber-700 transition hover:bg-amber-100"
                  >
                    <Archive className="h-3.5 w-3.5" />
                    归档
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
