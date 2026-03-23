import {
  POST_STATUS_FILTER_OPTIONS,
  POST_TYPE_FILTER_OPTIONS,
  type PostListParams,
} from '../api/client'

export interface PostManagementFilterDraft {
  status_filter: NonNullable<PostListParams['status_filter']>
  post_type: NonNullable<PostListParams['post_type']>
  client_keyword: string
  title_keyword: string
}

interface PostManagementFiltersProps {
  value: PostManagementFilterDraft
  isSubmitting: boolean
  onChange: <Key extends keyof PostManagementFilterDraft>(
    field: Key,
    nextValue: PostManagementFilterDraft[Key],
  ) => void
  onApply: () => void
  onReset: () => void
}

export default function PostManagementFilters({
  value,
  isSubmitting,
  onChange,
  onApply,
  onReset,
}: PostManagementFiltersProps) {
  return (
    <form
      className="grid gap-3 xl:grid-cols-[120px_132px_minmax(0,220px)_minmax(0,260px)_112px_112px]"
      onSubmit={(event) => {
        event.preventDefault()
        onApply()
      }}
    >
      <label className="space-y-1">
        <span className="text-xs font-semibold text-slate-700">状态</span>
        <select
          value={value.status_filter}
          onChange={(event) => onChange('status_filter', event.target.value as PostManagementFilterDraft['status_filter'])}
          className="h-9 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-100"
        >
          {POST_STATUS_FILTER_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>

      <label className="space-y-1">
        <span className="text-xs font-semibold text-slate-700">类型</span>
        <select
          value={value.post_type}
          onChange={(event) => onChange('post_type', event.target.value as PostManagementFilterDraft['post_type'])}
          className="h-9 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-100"
        >
          {POST_TYPE_FILTER_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>

      <label className="space-y-1">
        <span className="text-xs font-semibold text-slate-700">客户</span>
        <input
          type="text"
          value={value.client_keyword}
          onChange={(event) => onChange('client_keyword', event.target.value)}
          placeholder="搜索客户..."
          className="h-9 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-300 focus:ring-4 focus:ring-blue-100"
        />
      </label>

      <label className="space-y-1">
        <span className="text-xs font-semibold text-slate-700">标题</span>
        <input
          type="text"
          value={value.title_keyword}
          onChange={(event) => onChange('title_keyword', event.target.value)}
          placeholder="搜索标题..."
          className="h-9 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-300 focus:ring-4 focus:ring-blue-100"
        />
      </label>

      <button
        type="submit"
        disabled={isSubmitting}
        className="mt-auto inline-flex h-9 items-center justify-center rounded-md bg-blue-600 px-3 text-sm font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
      >
        应用筛选
      </button>

      <button
        type="button"
        disabled={isSubmitting}
        onClick={onReset}
        className="mt-auto inline-flex h-9 items-center justify-center rounded-md border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
      >
        重置
      </button>
    </form>
  )
}
