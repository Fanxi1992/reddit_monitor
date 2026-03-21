import { useDeferredValue, useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { LoaderCircle, RefreshCw, Search } from 'lucide-react'

import {
  apiClient,
  getApiErrorMessage,
  type ClientResponse,
  type PostResponse,
} from '../api/client'
import PostCard from '../components/PostCard'

type ClientFilterValue = 'unassigned' | `${number}`

export default function Dashboard() {
  const [posts, setPosts] = useState<PostResponse[]>([])
  const [clients, setClients] = useState<ClientResponse[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [selectedClient, setSelectedClient] = useState<ClientFilterValue | null>(null)
  const [clientSearch, setClientSearch] = useState('')
  const [screenshotRefreshVersion, setScreenshotRefreshVersion] = useState(0)
  const deferredClientSearch = useDeferredValue(clientSearch.trim().toLowerCase())

  const sortedClients = [...clients].sort((left, right) =>
    left.name.localeCompare(right.name, 'en', { sensitivity: 'base' }),
  )

  const selectedClientRecord =
    selectedClient && selectedClient !== 'unassigned'
      ? sortedClients.find((client) => client.id === Number(selectedClient)) ?? null
      : null

  const selectorCandidates = sortedClients.filter((client) => {
    if (!deferredClientSearch) {
      return true
    }

    return client.name.toLowerCase().includes(deferredClientSearch)
  })

  useEffect(() => {
    void initializeDashboard()
  }, [])

  function resolveSelectedClient(
    nextClients: ClientResponse[],
    preferredSelection: ClientFilterValue | null,
  ) {
    if (preferredSelection === 'unassigned') {
      return 'unassigned' as const
    }

    if (preferredSelection !== null) {
      const preferredClientId = Number(preferredSelection)
      const stillExists = nextClients.some((client) => client.id === preferredClientId)

      if (stillExists) {
        return `${preferredClientId}` as const
      }
    }

    if (nextClients.length === 0) {
      return null
    }

    return `${nextClients[0].id}` as const
  }

  function buildPostsQueryParams(selection: ClientFilterValue | null) {
    if (selection === 'unassigned') {
      return { unassigned: true }
    }

    if (selection === null) {
      return undefined
    }

    return { client_id: Number(selection) }
  }

  async function fetchPostsForSelection(
    selection: ClientFilterValue | null,
    options?: { silent?: boolean },
  ) {
    const silent = options?.silent ?? false

    if (silent) {
      setIsRefreshing(true)
    } else {
      setIsLoading(true)
    }

    try {
      if (selection === null) {
        setPosts([])
        return
      }

      const response = await apiClient.get<PostResponse[]>('/posts/', {
        params: buildPostsQueryParams(selection),
      })

      setPosts(response.data)
      setScreenshotRefreshVersion((currentVersion) => currentVersion + 1)
    } catch (error) {
      toast.error(getApiErrorMessage(error, '帖子列表加载失败，请稍后重试。'))
    } finally {
      setIsLoading(false)
      setIsRefreshing(false)
    }
  }

  async function initializeDashboard() {
    setIsLoading(true)

    try {
      const clientsResponse = await apiClient.get<ClientResponse[]>('/clients/')
      const nextClients = [...clientsResponse.data].sort((left, right) =>
        left.name.localeCompare(right.name, 'en', { sensitivity: 'base' }),
      )
      const defaultSelection = resolveSelectedClient(nextClients, null)

      setClients(nextClients)
      setSelectedClient(defaultSelection)

      if (defaultSelection === null) {
        setPosts([])
        return
      }

      const postsResponse = await apiClient.get<PostResponse[]>('/posts/', {
        params: buildPostsQueryParams(defaultSelection),
      })

      setPosts(postsResponse.data)
      setScreenshotRefreshVersion((currentVersion) => currentVersion + 1)
    } catch (error) {
      toast.error(getApiErrorMessage(error, '看板初始化失败，请稍后重试。'))
    } finally {
      setIsLoading(false)
      setIsRefreshing(false)
    }
  }

  async function fetchDashboardData(options?: { silent?: boolean }) {
    const silent = options?.silent ?? false

    if (silent) {
      setIsRefreshing(true)
    } else {
      setIsLoading(true)
    }

    try {
      const clientsResponse = await apiClient.get<ClientResponse[]>('/clients/')
      const nextClients = [...clientsResponse.data].sort((left, right) =>
        left.name.localeCompare(right.name, 'en', { sensitivity: 'base' }),
      )
      const nextSelection = resolveSelectedClient(nextClients, selectedClient)

      setClients(nextClients)
      setSelectedClient(nextSelection)

      if (nextSelection === null) {
        setPosts([])
        return
      }

      const postsResponse = await apiClient.get<PostResponse[]>('/posts/', {
        params: buildPostsQueryParams(nextSelection),
      })

      setPosts(postsResponse.data)
      setScreenshotRefreshVersion((currentVersion) => currentVersion + 1)
    } catch (error) {
      toast.error(getApiErrorMessage(error, '帖子列表加载失败，请稍后重试。'))
    } finally {
      setIsLoading(false)
      setIsRefreshing(false)
    }
  }

  async function handleSelectClient(nextSelection: ClientFilterValue) {
    setSelectedClient(nextSelection)
    setClientSearch('')
    await fetchPostsForSelection(nextSelection)
  }

  async function handleShowUnassigned() {
    await handleSelectClient('unassigned')
  }

  async function handleResetToDefaultClient() {
    const defaultClient = sortedClients[0]

    if (!defaultClient) {
      toast.error('当前没有可切换的客户。')
      return
    }

    await handleSelectClient(`${defaultClient.id}`)
  }

  function getSelectedClientTitle() {
    if (selectedClient === 'unassigned') {
      return '未分配客户看板'
    }

    if (selectedClientRecord) {
      return `${selectedClientRecord.name} 看板`
    }

    return '客户帖子看板'
  }

  async function handleUpdateNote(postId: number, operatorNote: string) {
    const response = await apiClient.put<PostResponse>(`/posts/${postId}/note`, {
      operator_note: operatorNote,
    })

    setPosts((currentPosts) =>
      currentPosts.map((currentPost) =>
        currentPost.id === postId ? response.data : currentPost,
      ),
    )

    return response.data
  }

  const totalCount = posts.length
  const removedCount = posts.filter((post) => post.status === 'Removed').length
  const activeCount = posts.filter((post) => post.status !== 'Removed').length

  return (
    <div className="space-y-5">
      <section className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="grid gap-4 md:grid-cols-3">
          <div className="self-start rounded-[28px] border border-white/75 bg-[rgba(255,255,255,0.88)] p-4 shadow-[0_18px_60px_rgba(148,163,184,0.10)]">
            <p className="text-[11px] uppercase tracking-[0.28em] text-slate-500">
              Total Posts
            </p>
            <div className="mt-2 text-3xl font-bold text-slate-900">{totalCount}</div>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              当前客户筛选范围内的帖子总数
            </p>
          </div>

          <div className="self-start rounded-[28px] border border-emerald-100 bg-[linear-gradient(180deg,rgba(240,253,244,0.95)_0%,rgba(255,255,255,0.95)_100%)] p-4 shadow-[0_18px_60px_rgba(16,185,129,0.08)]">
            <p className="text-[11px] uppercase tracking-[0.28em] text-emerald-700/80">
              Active
            </p>
            <div className="mt-2 text-3xl font-bold text-emerald-700">{activeCount}</div>
            <p className="mt-2 text-sm leading-6 text-emerald-700/80">
              仍在正常监控中的帖子
            </p>
          </div>

          <div className="self-start rounded-[28px] border border-red-100 bg-[linear-gradient(180deg,rgba(254,242,242,0.95)_0%,rgba(255,255,255,0.95)_100%)] p-4 shadow-[0_18px_60px_rgba(239,68,68,0.08)]">
            <p className="text-[11px] uppercase tracking-[0.28em] text-red-700/80">
              Removed Alert
            </p>
            <div className="mt-2 text-3xl font-bold text-red-700">{removedCount}</div>
            <p className="mt-2 text-sm leading-6 text-red-700/80">
              已被移除，需要运营快速干预
            </p>
          </div>
        </div>

        <div className="self-start rounded-[28px] border border-white/75 bg-[rgba(255,255,255,0.88)] p-4 shadow-[0_18px_60px_rgba(148,163,184,0.10)]">
          <div className="space-y-3">
            <div className="space-y-2">
              <span className="text-[11px] font-medium uppercase tracking-[0.28em] text-slate-500">
                Client Switcher
              </span>
              <div className="relative">
                <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={clientSearch}
                  onChange={(event) => setClientSearch(event.target.value)}
                  placeholder="输入关键词切换客户"
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50/80 px-11 py-2.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-orange-300 focus:bg-white focus:ring-4 focus:ring-orange-100"
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[11px] font-medium uppercase tracking-[0.18em] text-slate-500">
                当前查看
              </span>
              <span
                className={[
                  'inline-flex items-center rounded-full px-3 py-1 text-sm font-medium',
                  selectedClient === 'unassigned'
                    ? 'bg-amber-100 text-amber-700'
                    : 'bg-emerald-100 text-emerald-700',
                ].join(' ')}
              >
                {selectedClient === 'unassigned'
                  ? '未分配客户'
                  : (selectedClientRecord?.name ?? '尚未选择客户')}
              </span>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-2">
              {sortedClients.length === 0 ? (
                <div className="px-3 py-4 text-sm leading-6 text-slate-500">
                  当前还没有客户，请先去“登记新帖”页面创建客户。
                </div>
              ) : selectorCandidates.length === 0 ? (
                <div className="px-3 py-4 text-sm leading-6 text-slate-500">
                  没有匹配的客户，请换个关键词试试。
                </div>
              ) : (
                <div className="max-h-52 space-y-2 overflow-y-auto pr-1">
                  {selectorCandidates.slice(0, 8).map((client) => {
                    const isSelected = selectedClient === `${client.id}`

                    return (
                      <button
                        key={client.id}
                        type="button"
                        onClick={() => void handleSelectClient(`${client.id}`)}
                        className={[
                          'flex w-full items-center justify-between rounded-2xl px-3 py-2.5 text-left text-sm transition',
                          isSelected
                            ? 'bg-orange-50 text-orange-700 ring-1 ring-orange-200'
                            : 'bg-white text-slate-700 hover:bg-slate-100',
                        ].join(' ')}
                      >
                        <span className="truncate font-medium">{client.name}</span>
                        <span className="text-xs uppercase tracking-[0.18em] text-slate-400">
                          {isSelected ? 'Current' : 'Switch'}
                        </span>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => void handleResetToDefaultClient()}
                className="inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
              >
                回到字母第一位客户
              </button>

              <button
                type="button"
                onClick={() => void handleShowUnassigned()}
                className="inline-flex items-center justify-center rounded-2xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm font-medium text-amber-700 transition hover:border-amber-300 hover:bg-amber-100"
              >
                查看未分配客户
              </button>
            </div>
          </div>

          <button
            type="button"
            onClick={() => void fetchDashboardData({ silent: true })}
            className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
          >
            <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            刷新列表
          </button>
        </div>
      </section>

      <section className="rounded-[30px] border border-white/75 bg-[rgba(255,255,255,0.78)] p-5 shadow-[0_22px_70px_rgba(148,163,184,0.12)]">
        {isLoading ? (
          <div className="flex min-h-[320px] items-center justify-center gap-3 text-slate-500">
            <LoaderCircle className="h-5 w-5 animate-spin" />
            正在加载帖子列表...
          </div>
        ) : posts.length === 0 ? (
          <div className="flex min-h-[280px] flex-col items-center justify-center text-center">
            <p className="text-lg font-semibold text-slate-900">当前没有可展示的帖子</p>
            <p className="mt-2 text-sm text-slate-500">
              你可以切换客户、查看未分配客户，或先去“登记新帖”页面录入数据。
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-col gap-2 border-b border-slate-200/80 pb-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h3 className="text-lg font-bold text-slate-900">
                  {getSelectedClientTitle()}
                </h3>
                <p className="text-sm text-slate-500">
                  默认展示字母排序第一位客户。切换客户时支持关键词模糊匹配，删除客户后历史帖子会自动归到“未分配客户”。
                </p>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-2 text-sm text-slate-600">
                当前展示 {posts.length} 条帖子
              </div>
            </div>

            <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
              {posts.map((post) => (
                <PostCard
                  key={post.id}
                  post={post}
                  onUpdateNote={handleUpdateNote}
                  screenshotRefreshVersion={screenshotRefreshVersion}
                />
              ))}
            </div>
          </div>
        )}
      </section>
    </div>
  )
}
