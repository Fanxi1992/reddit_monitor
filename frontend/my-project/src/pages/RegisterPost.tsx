import type { FormEvent } from 'react'
import { useDeferredValue, useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import {
  CircleAlert,
  Link2,
  LoaderCircle,
  NotebookPen,
  Plus,
  Search,
  Trash2,
  UserRound,
} from 'lucide-react'

import {
  apiClient,
  getApiErrorMessage,
  type ClientResponse,
  type CreatePostPayload,
} from '../api/client'

interface RegisterFormState {
  url: string
  title: string
  client_id: number | null
  operator_note: string
}

const initialFormState: RegisterFormState = {
  url: '',
  title: '',
  client_id: null,
  operator_note: '',
}

export default function RegisterPost() {
  const [formState, setFormState] = useState(initialFormState)
  const [clients, setClients] = useState<ClientResponse[]>([])
  const [selectorQuery, setSelectorQuery] = useState('')
  const [managerSearch, setManagerSearch] = useState('')
  const [newClientName, setNewClientName] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isClientsLoading, setIsClientsLoading] = useState(true)
  const [isCreatingClient, setIsCreatingClient] = useState(false)
  const [deletingClientId, setDeletingClientId] = useState<number | null>(null)

  const deferredSelectorQuery = useDeferredValue(selectorQuery.trim().toLowerCase())
  const deferredManagerSearch = useDeferredValue(managerSearch.trim().toLowerCase())

  const selectedClient =
    clients.find((client) => client.id === formState.client_id) ?? null

  const selectorCandidates = clients.filter((client) => {
    if (!deferredSelectorQuery) {
      return true
    }

    return client.name.toLowerCase().includes(deferredSelectorQuery)
  })

  const managedClients = clients.filter((client) => {
    if (!deferredManagerSearch) {
      return true
    }

    return client.name.toLowerCase().includes(deferredManagerSearch)
  })

  useEffect(() => {
    void fetchClients()
  }, [])

  useEffect(() => {
    if (formState.client_id === null) {
      return
    }

    const stillExists = clients.some((client) => client.id === formState.client_id)
    if (!stillExists) {
      setFormState((current) => ({
        ...current,
        client_id: null,
      }))
      setSelectorQuery('')
    }
  }, [clients, formState.client_id])

  function updateField<Key extends keyof RegisterFormState>(
    field: Key,
    value: RegisterFormState[Key],
  ) {
    setFormState((current) => ({
      ...current,
      [field]: value,
    }))
  }

  async function fetchClients(options?: { silent?: boolean }) {
    const silent = options?.silent ?? false

    if (!silent) {
      setIsClientsLoading(true)
    }

    try {
      const response = await apiClient.get<ClientResponse[]>('/clients/')
      setClients(response.data)
    } catch (error) {
      toast.error(getApiErrorMessage(error, '客户列表加载失败，请稍后重试。'))
    } finally {
      setIsClientsLoading(false)
    }
  }

  function handleSelectClient(client: ClientResponse) {
    updateField('client_id', client.id)
    setSelectorQuery(client.name)
  }

  async function handleCreateClient(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const cleanedName = newClientName.trim()
    if (!cleanedName) {
      toast.error('请输入客户名称后再创建。')
      return
    }

    setIsCreatingClient(true)

    try {
      const response = await apiClient.post<ClientResponse>('/clients/', {
        name: cleanedName,
      })

      await fetchClients({ silent: true })
      handleSelectClient(response.data)
      setNewClientName('')
      setManagerSearch('')
      toast.success('客户已创建，并已自动选中。')
    } catch (error) {
      toast.error(getApiErrorMessage(error, '客户创建失败，请稍后重试。'))
    } finally {
      setIsCreatingClient(false)
    }
  }

  async function handleDeleteClient(client: ClientResponse) {
    const shouldDelete = window.confirm(
      `确定删除客户“${client.name}”吗？已有关联帖子会变成“未分配客户”。`,
    )

    if (!shouldDelete) {
      return
    }

    setDeletingClientId(client.id)

    try {
      await apiClient.delete(`/clients/${client.id}`)
      await fetchClients({ silent: true })

      if (formState.client_id === client.id) {
        updateField('client_id', null)
        setSelectorQuery('')
      }

      toast.success('客户已删除，相关帖子会显示为未分配客户。')
    } catch (error) {
      toast.error(getApiErrorMessage(error, '客户删除失败，请稍后重试。'))
    } finally {
      setDeletingClientId(null)
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (formState.client_id === null) {
      toast.error('请先从客户列表中选择一个客户，再提交帖子。')
      return
    }

    setIsSubmitting(true)

    const payload: CreatePostPayload = {
      url: formState.url,
      title: formState.title,
      client_id: formState.client_id,
      operator_note: formState.operator_note.trim() ? formState.operator_note : null,
    }

    try {
      await apiClient.post('/posts/', payload)

      setFormState(initialFormState)
      setSelectorQuery('')
      toast.success('登记成功')
    } catch (error) {
      toast.error(getApiErrorMessage(error, '登记失败，请稍后重试。'), {
        duration: 4200,
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1.25fr)_360px]">
      <section className="rounded-[30px] border border-white/70 bg-[rgba(255,255,255,0.86)] p-6 shadow-[0_22px_70px_rgba(148,163,184,0.12)]">
        <div className="mb-6 space-y-2">
          <p className="text-sm font-medium uppercase tracking-[0.24em] text-orange-700/80">
            New Post Intake
          </p>
          <h3 className="text-2xl font-bold text-slate-900">登记新的 Reddit 帖子</h3>
          <p className="max-w-2xl text-sm leading-6 text-slate-600">
            运营录入帖子后，系统会自动解析 Reddit Post ID，完成去重校验，并将帖子归到受控客户主数据下，避免客户名写法不一致。
          </p>
        </div>

        <form className="space-y-5" onSubmit={handleSubmit}>
          <label className="block space-y-2">
            <span className="flex items-center gap-2 text-sm font-medium text-slate-700">
              <Link2 className="h-4 w-4 text-orange-700" />
              帖子 URL
            </span>
            <input
              type="url"
              required
              value={formState.url}
              onChange={(event) => updateField('url', event.target.value)}
              placeholder="https://www.reddit.com/r/.../comments/xxxxxx/..."
              className="w-full rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-orange-300 focus:bg-white focus:ring-4 focus:ring-orange-100"
            />
          </label>

          <div className="grid gap-5 lg:grid-cols-2">
            <label className="block space-y-2">
              <span className="flex items-center gap-2 text-sm font-medium text-slate-700">
                <NotebookPen className="h-4 w-4 text-orange-700" />
                帖子标题
              </span>
              <input
                type="text"
                required
                value={formState.title}
                onChange={(event) => updateField('title', event.target.value)}
                placeholder="输入运营侧记录标题"
                className="w-full rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-orange-300 focus:bg-white focus:ring-4 focus:ring-orange-100"
              />
            </label>

            <div className="space-y-2">
              <span className="flex items-center gap-2 text-sm font-medium text-slate-700">
                <UserRound className="h-4 w-4 text-orange-700" />
                客户名称
              </span>

              <div className="rounded-[26px] border border-slate-200 bg-slate-50/60 p-3">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={selectorQuery}
                    onChange={(event) => {
                      const nextValue = event.target.value
                      setSelectorQuery(nextValue)

                      if (selectedClient && nextValue !== selectedClient.name) {
                        updateField('client_id', null)
                      }
                    }}
                    placeholder="输入关键词检索客户，然后点选下方结果"
                    className="w-full rounded-2xl border border-slate-200 bg-white px-11 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-orange-300 focus:ring-4 focus:ring-orange-100"
                  />
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <span className="text-xs font-medium uppercase tracking-[0.2em] text-slate-500">
                    当前选择
                  </span>
                  <span
                    className={[
                      'inline-flex items-center rounded-full px-3 py-1 text-sm font-medium',
                      selectedClient
                        ? 'bg-emerald-100 text-emerald-700'
                        : 'bg-amber-100 text-amber-700',
                    ].join(' ')}
                  >
                    {selectedClient ? selectedClient.name : '尚未选择客户'}
                  </span>
                </div>

                <div className="mt-3 rounded-2xl border border-slate-200 bg-white/90 p-2">
                  {isClientsLoading ? (
                    <div className="flex items-center gap-2 px-3 py-4 text-sm text-slate-500">
                      <LoaderCircle className="h-4 w-4 animate-spin" />
                      正在加载客户列表...
                    </div>
                  ) : clients.length === 0 ? (
                    <div className="px-3 py-4 text-sm leading-6 text-slate-500">
                      当前还没有客户，请先在右侧“客户管理”中新增客户。
                    </div>
                  ) : selectorCandidates.length === 0 ? (
                    <div className="px-3 py-4 text-sm leading-6 text-slate-500">
                      没有匹配的客户，请换个关键词搜索，或先在右侧创建新客户。
                    </div>
                  ) : (
                    <div className="max-h-52 space-y-2 overflow-y-auto pr-1">
                      {selectorCandidates.slice(0, 8).map((client) => {
                        const isSelected = client.id === formState.client_id

                        return (
                          <button
                            key={client.id}
                            type="button"
                            onClick={() => handleSelectClient(client)}
                            className={[
                              'flex w-full items-center justify-between rounded-2xl px-3 py-3 text-left text-sm transition',
                              isSelected
                                ? 'bg-orange-50 text-orange-700 ring-1 ring-orange-200'
                                : 'bg-slate-50 text-slate-700 hover:bg-slate-100',
                            ].join(' ')}
                          >
                            <span className="truncate font-medium">{client.name}</span>
                            <span className="text-xs uppercase tracking-[0.18em] text-slate-400">
                              {isSelected ? 'Selected' : 'Pick'}
                            </span>
                          </button>
                        )
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          <label className="block space-y-2">
            <span className="text-sm font-medium text-slate-700">运营备注</span>
            <textarea
              rows={6}
              value={formState.operator_note}
              onChange={(event) => updateField('operator_note', event.target.value)}
              placeholder="可填写已发、已补赞、发帖时段、补评论安排等运营信息"
              className="w-full rounded-3xl border border-slate-200 bg-slate-50/70 px-4 py-3 text-sm leading-6 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-orange-300 focus:bg-white focus:ring-4 focus:ring-orange-100"
            />
          </label>

          <div className="flex flex-col gap-3 border-t border-slate-200/80 pt-5 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-slate-500">
              登记前必须选定客户。后端会继续校验 URL 可解析性与 Reddit Post ID 是否重复。
            </p>

            <button
              type="submit"
              disabled={isSubmitting || formState.client_id === null}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[linear-gradient(135deg,#1f2937_0%,#c84f2f_100%)] px-5 py-3 text-sm font-semibold text-white shadow-[0_16px_40px_rgba(200,79,47,0.28)] transition hover:translate-y-[-1px] hover:shadow-[0_20px_50px_rgba(200,79,47,0.32)] disabled:cursor-not-allowed disabled:opacity-70"
            >
              {isSubmitting ? (
                <>
                  <LoaderCircle className="h-4 w-4 animate-spin" />
                  提交中...
                </>
              ) : (
                '登记并开始监控'
              )}
            </button>
          </div>
        </form>
      </section>

      <aside className="space-y-5">
        <div className="rounded-[30px] border border-orange-200/70 bg-[linear-gradient(180deg,rgba(255,245,237,0.95)_0%,rgba(255,255,255,0.95)_100%)] p-5 shadow-[0_18px_60px_rgba(234,88,12,0.08)]">
          <div className="flex items-start gap-3">
            <div className="rounded-2xl bg-orange-100 p-2 text-orange-700">
              <CircleAlert className="h-5 w-5" />
            </div>
            <div>
              <h4 className="font-semibold text-slate-900">录入建议</h4>
              <ul className="mt-3 space-y-3 text-sm leading-6 text-slate-600">
                <li>优先贴标准详情页 URL，系统会自动解析 reddit_id。</li>
                <li>客户必须从主数据中选择，避免同一客户出现多种写法。</li>
                <li>备注尽量记录“补赞、补评、发布时间”等可复盘信息。</li>
              </ul>
            </div>
          </div>
        </div>

        <div className="rounded-[30px] border border-slate-200/80 bg-[rgba(255,255,255,0.86)] p-5 shadow-[0_18px_60px_rgba(148,163,184,0.10)]">
          <div className="space-y-2">
            <p className="text-xs font-medium uppercase tracking-[0.24em] text-slate-500">
              Client Management
            </p>
            <h4 className="text-lg font-bold text-slate-900">客户管理</h4>
            <p className="text-sm leading-6 text-slate-600">
              在这里维护可被运营选择的客户范围。新增或删除后，登记页和看板筛选会立即使用同一套主数据。
            </p>
          </div>

          <form className="mt-5 space-y-3" onSubmit={handleCreateClient}>
            <label className="block space-y-2">
              <span className="text-sm font-medium text-slate-700">新增客户</span>
              <input
                type="text"
                value={newClientName}
                onChange={(event) => setNewClientName(event.target.value)}
                placeholder="输入新的客户名称"
                className="w-full rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-orange-300 focus:bg-white focus:ring-4 focus:ring-orange-100"
              />
            </label>

            <button
              type="submit"
              disabled={isCreatingClient}
              className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-900 px-4 py-3 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isCreatingClient ? (
                <>
                  <LoaderCircle className="h-4 w-4 animate-spin" />
                  创建中...
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4" />
                  新增客户
                </>
              )}
            </button>
          </form>

          <div className="mt-5 space-y-3">
            <label className="block space-y-2">
              <span className="text-sm font-medium text-slate-700">检索客户</span>
              <div className="relative">
                <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={managerSearch}
                  onChange={(event) => setManagerSearch(event.target.value)}
                  placeholder="输入关键词筛选客户"
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50/80 px-11 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-orange-300 focus:bg-white focus:ring-4 focus:ring-orange-100"
                />
              </div>
            </label>

            <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-2">
              {isClientsLoading ? (
                <div className="flex items-center gap-2 px-3 py-4 text-sm text-slate-500">
                  <LoaderCircle className="h-4 w-4 animate-spin" />
                  正在同步客户列表...
                </div>
              ) : managedClients.length === 0 ? (
                <div className="px-3 py-4 text-sm leading-6 text-slate-500">
                  当前没有匹配的客户结果。
                </div>
              ) : (
                <div className="max-h-[360px] space-y-2 overflow-y-auto pr-1">
                  {managedClients.map((client) => (
                    <div
                      key={client.id}
                      className="flex items-center justify-between gap-3 rounded-2xl bg-white px-3 py-3"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-slate-900">
                          {client.name}
                        </p>
                        <p className="mt-1 text-xs uppercase tracking-[0.18em] text-slate-400">
                          ID {client.id}
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() => void handleDeleteClient(client)}
                        disabled={deletingClientId === client.id}
                        className="inline-flex items-center gap-2 rounded-2xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {deletingClientId === client.id ? (
                          <LoaderCircle className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                        删除
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </aside>
    </div>
  )
}
