import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'

import {
  DEFAULT_PAGE_SIZE,
  fetchPostRetentionHistory,
  fetchRetentionPostsPage,
  getApiErrorMessage,
  type PostRetentionHistoryResponse,
  type PostRetentionListParams,
  type PostRetentionRowResponse,
} from '../api/client'
import PaginationControls from '../components/PaginationControls'
import PostRetentionFilters, {
  type PostRetentionFilterDraft,
} from '../components/PostRetentionFilters'
import PostRetentionHistoryModal from '../components/PostRetentionHistoryModal'
import PostRetentionTable from '../components/PostRetentionTable'

const DEFAULT_FILTERS: PostRetentionFilterDraft = {
  status_filter: 'all',
  post_type: 'all',
  client_keyword: '',
  title_keyword: '',
}

interface PaginationState {
  page: number
  pageSize: number
  totalCount: number
  totalPages: number
}

function buildRetentionListParams(
  filters: PostRetentionFilterDraft,
): PostRetentionListParams {
  return {
    status_filter: filters.status_filter,
    post_type: filters.post_type,
    client_keyword: filters.client_keyword.trim() || undefined,
    title_keyword: filters.title_keyword.trim() || undefined,
  }
}

function createDefaultPaginationState(): PaginationState {
  return {
    page: 1,
    pageSize: DEFAULT_PAGE_SIZE,
    totalCount: 0,
    totalPages: 0,
  }
}

export default function PostRetention() {
  const [rows, setRows] = useState<PostRetentionRowResponse[]>([])
  const [filterDraft, setFilterDraft] = useState<PostRetentionFilterDraft>(DEFAULT_FILTERS)
  const [appliedFilters, setAppliedFilters] = useState<PostRetentionFilterDraft>(DEFAULT_FILTERS)
  const [pagination, setPagination] = useState<PaginationState>(createDefaultPaginationState)
  const [isLoading, setIsLoading] = useState(true)
  const [activeHistoryRow, setActiveHistoryRow] = useState<PostRetentionRowResponse | null>(null)
  const [history, setHistory] = useState<PostRetentionHistoryResponse | null>(null)
  const [isHistoryLoading, setIsHistoryLoading] = useState(false)
  const [historyErrorMessage, setHistoryErrorMessage] = useState('')

  useEffect(() => {
    let isCancelled = false

    async function initializeRetention() {
      setIsLoading(true)

      try {
        const nextPage = await fetchRetentionPostsPage({
          ...buildRetentionListParams(DEFAULT_FILTERS),
          page: 1,
          page_size: DEFAULT_PAGE_SIZE,
        })

        if (!isCancelled) {
          setAppliedFilters(DEFAULT_FILTERS)
          setRows(nextPage.items)
          setPagination({
            page: nextPage.total_pages === 0 ? 1 : nextPage.page,
            pageSize: nextPage.page_size,
            totalCount: nextPage.total_count,
            totalPages: nextPage.total_pages,
          })
        }
      } catch (error) {
        if (!isCancelled) {
          toast.error(getApiErrorMessage(error, '帖子留存列表加载失败，请稍后重试。'))
          setRows([])
          setPagination(createDefaultPaginationState())
        }
      } finally {
        if (!isCancelled) {
          setIsLoading(false)
        }
      }
    }

    void initializeRetention()

    return () => {
      isCancelled = true
    }
  }, [])

  function updateFilterDraft<Key extends keyof PostRetentionFilterDraft>(
    field: Key,
    nextValue: PostRetentionFilterDraft[Key],
  ) {
    setFilterDraft((current) => ({
      ...current,
      [field]: nextValue,
    }))
  }

  async function loadRows(
    filters: PostRetentionFilterDraft,
    page: number,
  ) {
    setIsLoading(true)

    try {
      const nextPage = await fetchRetentionPostsPage({
        ...buildRetentionListParams(filters),
        page,
        page_size: DEFAULT_PAGE_SIZE,
      })

      if (page > 1 && nextPage.total_pages > 0 && page > nextPage.total_pages) {
        await loadRows(filters, nextPage.total_pages)
        return
      }

      setAppliedFilters(filters)
      setRows(nextPage.items)
      setPagination({
        page: nextPage.total_pages === 0 ? 1 : nextPage.page,
        pageSize: nextPage.page_size,
        totalCount: nextPage.total_count,
        totalPages: nextPage.total_pages,
      })
    } catch (error) {
      toast.error(getApiErrorMessage(error, '帖子留存列表加载失败，请稍后重试。'))
      setRows([])
      setPagination((current) => ({
        ...current,
        page: 1,
        totalCount: 0,
        totalPages: 0,
      }))
    } finally {
      setIsLoading(false)
    }
  }

  async function handleApplyFilters() {
    await loadRows(filterDraft, 1)
  }

  async function handleResetFilters() {
    setFilterDraft(DEFAULT_FILTERS)
    await loadRows(DEFAULT_FILTERS, 1)
  }

  async function handlePageChange(nextPage: number) {
    if (nextPage < 1 || nextPage === pagination.page || isLoading) {
      return
    }

    await loadRows(appliedFilters, nextPage)
  }

  async function handleOpenHistory(row: PostRetentionRowResponse) {
    setActiveHistoryRow(row)
    setHistory(null)
    setHistoryErrorMessage('')
    setIsHistoryLoading(true)

    try {
      const nextHistory = await fetchPostRetentionHistory(row.id)
      setHistory(nextHistory)
    } catch (error) {
      setHistoryErrorMessage(getApiErrorMessage(error, '截图历史加载失败，请稍后重试。'))
    } finally {
      setIsHistoryLoading(false)
    }
  }

  return (
    <section className="space-y-4">
      <div className="flex flex-col gap-3 border-b border-slate-200 pb-4 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <h3 className="text-2xl font-bold tracking-tight text-slate-950">帖子留存</h3>
          <p className="mt-1 text-sm leading-6 text-slate-500">
            每日自动截图监控帖子状态 · 共 {pagination.totalCount} 条记录
          </p>
        </div>

        <div className="flex items-center gap-5 text-sm text-slate-600">
          <div className="flex items-center gap-2">
            <span className="inline-block h-3 w-3 rounded-full bg-emerald-500" />
            <span>正常</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-block h-3 w-3 rounded-full bg-red-500" />
            <span>被Ban</span>
          </div>
        </div>
      </div>

      <div className="border border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-4 py-3">
          <PostRetentionFilters
            value={filterDraft}
            isSubmitting={isLoading}
            onChange={updateFilterDraft}
            onApply={() => void handleApplyFilters()}
            onReset={() => void handleResetFilters()}
          />
        </div>

        <PostRetentionTable
          rows={rows}
          isLoading={isLoading}
          onOpenHistory={handleOpenHistory}
        />

        <PaginationControls
          page={pagination.page}
          pageSize={pagination.pageSize}
          totalCount={pagination.totalCount}
          totalPages={pagination.totalPages}
          isLoading={isLoading}
          onPageChange={(nextPage) => void handlePageChange(nextPage)}
        />
      </div>

      <PostRetentionHistoryModal
        open={activeHistoryRow !== null}
        title={history?.title ?? activeHistoryRow?.title ?? '截图历史记录'}
        isLoading={isHistoryLoading}
        errorMessage={historyErrorMessage}
        history={history}
        onClose={() => {
          if (isHistoryLoading) {
            return
          }

          setActiveHistoryRow(null)
          setHistory(null)
          setHistoryErrorMessage('')
        }}
      />
    </section>
  )
}
