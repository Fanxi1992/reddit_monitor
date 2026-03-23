import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'

import {
  fetchPostRetentionHistory,
  fetchRetentionPosts,
  getApiErrorMessage,
  type PostRetentionHistoryResponse,
  type PostRetentionListParams,
  type PostRetentionRowResponse,
} from '../api/client'
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

export default function PostRetention() {
  const [rows, setRows] = useState<PostRetentionRowResponse[]>([])
  const [filterDraft, setFilterDraft] = useState<PostRetentionFilterDraft>(DEFAULT_FILTERS)
  const [isLoading, setIsLoading] = useState(true)
  const [activeHistoryRow, setActiveHistoryRow] = useState<PostRetentionRowResponse | null>(null)
  const [history, setHistory] = useState<PostRetentionHistoryResponse | null>(null)
  const [isHistoryLoading, setIsHistoryLoading] = useState(false)
  const [historyErrorMessage, setHistoryErrorMessage] = useState('')

  useEffect(() => {
    void loadRows(DEFAULT_FILTERS)
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

  async function loadRows(filters: PostRetentionFilterDraft) {
    setIsLoading(true)

    try {
      const nextRows = await fetchRetentionPosts(buildRetentionListParams(filters))
      setRows(nextRows)
    } catch (error) {
      toast.error(getApiErrorMessage(error, '帖子留存列表加载失败，请稍后重试。'))
      setRows([])
    } finally {
      setIsLoading(false)
    }
  }

  async function handleApplyFilters() {
    await loadRows(filterDraft)
  }

  async function handleResetFilters() {
    setFilterDraft(DEFAULT_FILTERS)
    await loadRows(DEFAULT_FILTERS)
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
            每日自动截图监控帖子状态 · 共 {rows.length} 条记录
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
