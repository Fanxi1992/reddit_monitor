interface PaginationControlsProps {
  page: number
  pageSize: number
  totalCount: number
  totalPages: number
  isLoading?: boolean
  onPageChange: (page: number) => void
}

export default function PaginationControls({
  page,
  pageSize,
  totalCount,
  totalPages,
  isLoading = false,
  onPageChange,
}: PaginationControlsProps) {
  const hasRecords = totalCount > 0
  const canGoPrevious = !isLoading && page > 1
  const canGoNext = !isLoading && hasRecords && page < totalPages
  const currentPageLabel = hasRecords ? `${page} / ${totalPages}` : '0 / 0'

  return (
    <div className="flex flex-col gap-3 border-t border-slate-200 px-4 py-3 text-sm text-slate-600 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
        <span>共 {totalCount} 条记录</span>
        <span>每页 {pageSize} 条</span>
        <span>第 {currentPageLabel} 页</span>
      </div>

      <div className="flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={() => onPageChange(page - 1)}
          disabled={!canGoPrevious}
          className="inline-flex h-9 items-center justify-center rounded-md border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          上一页
        </button>
        <button
          type="button"
          onClick={() => onPageChange(page + 1)}
          disabled={!canGoNext}
          className="inline-flex h-9 items-center justify-center rounded-md border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          下一页
        </button>
      </div>
    </div>
  )
}
