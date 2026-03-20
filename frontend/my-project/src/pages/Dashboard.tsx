import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { LoaderCircle, RefreshCw } from 'lucide-react'

import {
  apiClient,
  getApiErrorMessage,
  type ClientResponse,
  type PostResponse,
} from '../api/client'
import PostCard from '../components/PostCard'

type ClientFilterValue = 'all' | 'unassigned' | `${number}`

export default function Dashboard() {
  const [posts, setPosts] = useState<PostResponse[]>([])
  const [clients, setClients] = useState<ClientResponse[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [selectedClient, setSelectedClient] = useState<ClientFilterValue>('all')
  const [screenshotRefreshVersion, setScreenshotRefreshVersion] = useState(0)

  useEffect(() => {
    void fetchDashboardData()
  }, [])

  useEffect(() => {
    if (selectedClient === 'all' || selectedClient === 'unassigned') {
      return
    }

    const selectedClientId = Number(selectedClient)
    const stillExists = clients.some((client) => client.id === selectedClientId)

    if (!stillExists) {
      setSelectedClient('all')
    }
  }, [clients, selectedClient])

  async function fetchDashboardData(options?: { silent?: boolean }) {
    const silent = options?.silent ?? false

    if (silent) {
      setIsRefreshing(true)
    } else {
      setIsLoading(true)
    }

    try {
      const [postsResponse, clientsResponse] = await Promise.all([
        apiClient.get<PostResponse[]>('/posts/'),
        apiClient.get<ClientResponse[]>('/clients/'),
      ])

      setPosts(postsResponse.data)
      setClients(clientsResponse.data)
      // 帖子主列表刷新成功后，顺带通知所有卡片重新同步一次截图留存状态。
      setScreenshotRefreshVersion((currentVersion) => currentVersion + 1)
    } catch (error) {
      toast.error(getApiErrorMessage(error, '帖子列表加载失败，请稍后重试。'))
    } finally {
      setIsLoading(false)
      setIsRefreshing(false)
    }
  }

  function getSelectedClientTitle() {
    if (selectedClient === 'all') {
      return '全部客户帖子看板'
    }

    if (selectedClient === 'unassigned') {
      return '未分配客户看板'
    }

    const client = clients.find((item) => item.id === Number(selectedClient))
    return client ? `${client.name} 看板` : '全部客户帖子看板'
  }

  const filteredPosts = posts.filter((post) => {
    if (selectedClient === 'all') {
      return true
    }

    if (selectedClient === 'unassigned') {
      return post.client_id === null
    }

    return post.client_id === Number(selectedClient)
  })

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

  const totalCount = filteredPosts.length
  const removedCount = filteredPosts.filter((post) => post.status === 'Removed').length
  const activeCount = filteredPosts.filter((post) => post.status !== 'Removed').length

  return (
    <div className="space-y-5">
      <section className="grid gap-4 xl:grid-cols-[repeat(3,minmax(0,1fr))_320px]">
        <div className="rounded-[28px] border border-white/75 bg-[rgba(255,255,255,0.88)] p-5 shadow-[0_18px_60px_rgba(148,163,184,0.10)]">
          <p className="text-xs uppercase tracking-[0.28em] text-slate-500">Total Posts</p>
          <div className="mt-3 text-3xl font-bold text-slate-900">{totalCount}</div>
          <p className="mt-2 text-sm text-slate-500">当前筛选范围内的帖子总数</p>
        </div>

        <div className="rounded-[28px] border border-emerald-100 bg-[linear-gradient(180deg,rgba(240,253,244,0.95)_0%,rgba(255,255,255,0.95)_100%)] p-5 shadow-[0_18px_60px_rgba(16,185,129,0.08)]">
          <p className="text-xs uppercase tracking-[0.28em] text-emerald-700/80">Active</p>
          <div className="mt-3 text-3xl font-bold text-emerald-700">{activeCount}</div>
          <p className="mt-2 text-sm text-emerald-700/80">仍在正常监控中的帖子</p>
        </div>

        <div className="rounded-[28px] border border-red-100 bg-[linear-gradient(180deg,rgba(254,242,242,0.95)_0%,rgba(255,255,255,0.95)_100%)] p-5 shadow-[0_18px_60px_rgba(239,68,68,0.08)]">
          <p className="text-xs uppercase tracking-[0.28em] text-red-700/80">Removed Alert</p>
          <div className="mt-3 text-3xl font-bold text-red-700">{removedCount}</div>
          <p className="mt-2 text-sm text-red-700/80">已被移除，需要运营快速干预</p>
        </div>

        <div className="rounded-[28px] border border-white/75 bg-[rgba(255,255,255,0.88)] p-5 shadow-[0_18px_60px_rgba(148,163,184,0.10)]">
          <label className="block space-y-2">
            <span className="text-xs font-medium uppercase tracking-[0.28em] text-slate-500">
              Client Filter
            </span>
            <select
              value={selectedClient}
              onChange={(event) =>
                setSelectedClient(event.target.value as ClientFilterValue)
              }
              className="w-full rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-orange-300 focus:bg-white focus:ring-4 focus:ring-orange-100"
            >
              <option value="all">全部客户</option>
              <option value="unassigned">未分配客户</option>
              {clients.map((client) => (
                <option key={client.id} value={`${client.id}`}>
                  {client.name}
                </option>
              ))}
            </select>
          </label>

          <button
            type="button"
            onClick={() => void fetchDashboardData({ silent: true })}
            className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
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
        ) : filteredPosts.length === 0 ? (
          <div className="flex min-h-[280px] flex-col items-center justify-center text-center">
            <p className="text-lg font-semibold text-slate-900">当前没有可展示的帖子</p>
            <p className="mt-2 text-sm text-slate-500">
              你可以先去“登记新帖”页面录入数据，或切换客户筛选条件。
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
                  客户筛选已改为主数据驱动。删除客户后，历史帖子会自动归到“未分配客户”。
                </p>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-2 text-sm text-slate-600">
                当前展示 {filteredPosts.length} 条帖子
              </div>
            </div>

            <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
              {filteredPosts.map((post) => (
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
