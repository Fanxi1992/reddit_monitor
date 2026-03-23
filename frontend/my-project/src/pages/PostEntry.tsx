import type { FormEvent } from 'react'
import { useDeferredValue, useEffect, useRef, useState } from 'react'
import toast from 'react-hot-toast'
import {
  ChevronDown,
  Link2,
  LoaderCircle,
  NotebookPen,
  Plus,
  Search,
  Tag,
  Trash2,
  UserRound,
} from 'lucide-react'

import {
  apiClient,
  getApiErrorMessage,
  POST_TYPE_OPTIONS,
  type ClientResponse,
  type CreatePostPayload,
  type PostType,
} from '../api/client'

interface PostEntryFormState {
  url: string
  title: string
  client_id: number | null
  post_type: PostType
  operator_note: string
}

const initialFormState: PostEntryFormState = {
  url: '',
  title: '',
  client_id: null,
  post_type: '原创',
  operator_note: '',
}

export default function PostEntry() {
  const [formState, setFormState] = useState(initialFormState)
  const [clients, setClients] = useState<ClientResponse[]>([])
  const [selectorQuery, setSelectorQuery] = useState('')
  const [managerSearch, setManagerSearch] = useState('')
  const [newClientName, setNewClientName] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isClientsLoading, setIsClientsLoading] = useState(true)
  const [isCreatingClient, setIsCreatingClient] = useState(false)
  const [deletingClientId, setDeletingClientId] = useState<number | null>(null)
  const [isClientDropdownOpen, setIsClientDropdownOpen] = useState(false)

  const selectorContainerRef = useRef<HTMLDivElement | null>(null)

  const deferredSelectorQuery = useDeferredValue(selectorQuery.trim().toLowerCase())
  const deferredManagerSearch = useDeferredValue(managerSearch.trim().toLowerCase())

  const sortedClients = [...clients].sort((left, right) =>
    left.name.localeCompare(right.name, 'en', { sensitivity: 'base' }),
  )

  const selectedClient =
    sortedClients.find((client) => client.id === formState.client_id) ?? null

  const selectorCandidates = sortedClients.filter((client) => {
    if (!deferredSelectorQuery) {
      return true
    }

    return client.name.toLowerCase().includes(deferredSelectorQuery)
  })

  const managedClients = sortedClients.filter((client) => {
    if (!deferredManagerSearch) {
      return true
    }

    return client.name.toLowerCase().includes(deferredManagerSearch)
  })

  useEffect(() => {
    void fetchClients()
  }, [])

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (!selectorContainerRef.current) {
        return
      }

      if (!selectorContainerRef.current.contains(event.target as Node)) {
        setIsClientDropdownOpen(false)
      }
    }

    document.addEventListener('mousedown', handlePointerDown)
    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
    }
  }, [])

  useEffect(() => {
    if (formState.client_id === null) {
      return
    }

    const stillExists = sortedClients.some((client) => client.id === formState.client_id)
    if (!stillExists) {
      setFormState((current) => ({
        ...current,
        client_id: null,
      }))
      setSelectorQuery('')
    }
  }, [sortedClients, formState.client_id])

  function updateField<Key extends keyof PostEntryFormState>(
    field: Key,
    value: PostEntryFormState[Key],
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
      if (!Array.isArray(response.data)) {
        throw new Error('客户列表响应格式异常。')
      }

      setClients(response.data)
    } catch (error) {
      toast.error(getApiErrorMessage(error, '客户列表加载失败，请稍后重试。'))
      setClients([])
    } finally {
      setIsClientsLoading(false)
    }
  }

  function handleSelectClient(client: ClientResponse) {
    updateField('client_id', client.id)
    setSelectorQuery(client.name)
    setIsClientDropdownOpen(false)
  }

  function resetForm() {
    setFormState(initialFormState)
    setSelectorQuery('')
    setIsClientDropdownOpen(false)
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
      toast.error('请选择客户后再提交。')
      return
    }

    setIsSubmitting(true)

    const payload: CreatePostPayload = {
      url: formState.url.trim(),
      title: formState.title.trim(),
      client_id: formState.client_id,
      post_type: formState.post_type,
      operator_note: formState.operator_note.trim()
        ? formState.operator_note.trim()
        : null,
    }

    try {
      await apiClient.post('/posts/', payload)
      resetForm()
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
    <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
      <section className="border border-slate-200 bg-white p-4">
        <form className="space-y-4" onSubmit={handleSubmit}>
          <label className="block space-y-1.5">
            <span className="flex items-center gap-2 text-sm font-semibold text-slate-800">
              <Link2 className="h-4 w-4 text-blue-600" />
              Reddit 链接
              <span className="text-red-500">*</span>
            </span>
            <input
              type="url"
              required
              value={formState.url}
              onChange={(event) => updateField('url', event.target.value)}
              placeholder="https://reddit.com/r/..."
              className="w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-300 focus:ring-4 focus:ring-blue-100"
            />
          </label>

          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_210px]">
            <label className="block space-y-1.5">
              <span className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                <NotebookPen className="h-4 w-4 text-blue-600" />
                帖子标题
                <span className="text-red-500">*</span>
              </span>
              <input
                type="text"
                required
                value={formState.title}
                onChange={(event) => updateField('title', event.target.value)}
                placeholder="输入帖子标题"
                className="w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-300 focus:ring-4 focus:ring-blue-100"
              />
            </label>

            <label className="block space-y-1.5">
              <span className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                <Tag className="h-4 w-4 text-blue-600" />
                帖子类型
                <span className="text-red-500">*</span>
              </span>
              <select
                value={formState.post_type}
                onChange={(event) =>
                  updateField('post_type', event.target.value as PostType)
                }
                className="w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-100"
              >
                {POST_TYPE_OPTIONS.map((postType) => (
                  <option key={postType} value={postType}>
                    {postType}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div ref={selectorContainerRef} className="space-y-1.5">
            <span className="flex items-center gap-2 text-sm font-semibold text-slate-800">
              <UserRound className="h-4 w-4 text-blue-600" />
              选择客户
              <span className="text-red-500">*</span>
            </span>

            <div className="relative">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={selectorQuery}
                onFocus={() => setIsClientDropdownOpen(true)}
                onChange={(event) => {
                  const nextValue = event.target.value
                  setSelectorQuery(nextValue)
                  setIsClientDropdownOpen(true)

                  if (selectedClient && nextValue !== selectedClient.name) {
                    updateField('client_id', null)
                  }
                }}
                placeholder="输入客户名称关键词搜索..."
                className="w-full rounded-lg border border-slate-200 bg-white px-10 py-2.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-300 focus:ring-4 focus:ring-blue-100"
              />
              <ChevronDown className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />

              {isClientDropdownOpen ? (
                <div className="absolute left-0 right-0 top-[calc(100%+6px)] z-20 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-[0_12px_32px_rgba(15,23,42,0.12)]">
                  {isClientsLoading ? (
                    <div className="flex items-center gap-2 px-4 py-4 text-sm text-slate-500">
                      <LoaderCircle className="h-4 w-4 animate-spin" />
                      正在加载客户列表...
                    </div>
                  ) : sortedClients.length === 0 ? (
                    <div className="px-4 py-4 text-sm leading-6 text-slate-500">
                      当前还没有客户，请先在右侧添加客户。
                    </div>
                  ) : selectorCandidates.length === 0 ? (
                    <div className="px-4 py-4 text-sm leading-6 text-slate-500">
                      没有匹配的客户，请换个关键词继续搜索。
                    </div>
                  ) : (
                    <div className="max-h-44 overflow-y-auto p-1">
                      {selectorCandidates.slice(0, 8).map((client) => {
                        const isSelected = client.id === formState.client_id

                        return (
                          <button
                            key={client.id}
                            type="button"
                            onClick={() => handleSelectClient(client)}
                            className={[
                              'flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm transition',
                              isSelected
                                ? 'bg-blue-50 text-blue-700'
                                : 'text-slate-700 hover:bg-slate-50',
                            ].join(' ')}
                          >
                            <span className="truncate font-medium">{client.name}</span>
                            <span className="text-xs uppercase tracking-[0.18em] text-slate-400">
                              {isSelected ? 'Current' : 'Pick'}
                            </span>
                          </button>
                        )
                      })}
                    </div>
                  )}
                </div>
              ) : null}
            </div>
          </div>

          <label className="block space-y-1.5">
            <span className="text-sm font-semibold text-slate-800">备注说明</span>
            <textarea
              rows={3}
              value={formState.operator_note}
              onChange={(event) => updateField('operator_note', event.target.value)}
              placeholder="添加运营备注、特殊说明等非结构化信息"
              className="w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-sm leading-6 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-300 focus:ring-4 focus:ring-blue-100"
            />
          </label>

          <div className="grid gap-2.5 border-t border-slate-200 pt-4 md:grid-cols-2">
            <button
              type="submit"
              disabled={isSubmitting || formState.client_id === null}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-[linear-gradient(135deg,#3b82f6_0%,#2563eb_100%)] px-4 py-2.5 text-sm font-semibold text-white transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting ? (
                <>
                  <LoaderCircle className="h-4 w-4 animate-spin" />
                  提交中...
                </>
              ) : (
                '提交登记'
              )}
            </button>

            <button
              type="button"
              onClick={resetForm}
              disabled={isSubmitting}
              className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-slate-100 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-60"
            >
              取消
            </button>
          </div>
        </form>
      </section>

      <aside className="border border-slate-200 bg-white p-4">
        <div>
          <h3 className="text-[1.55rem] font-bold tracking-tight text-slate-950">客户管理</h3>
          <p className="mt-1.5 text-sm leading-6 text-slate-500">
            在这里可以查看已有客户，也可以新增或删除客户。当你选中或删除客户后，这一变动会同步到整个系统。
          </p>
        </div>

        <form className="mt-4 flex gap-2.5" onSubmit={handleCreateClient}>
          <input
            type="text"
            value={newClientName}
            onChange={(event) => setNewClientName(event.target.value)}
            placeholder="输入新客户名称"
            className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-300 focus:ring-4 focus:ring-blue-100"
          />
          <button
            type="submit"
            disabled={isCreatingClient}
            className="inline-flex h-[42px] w-[46px] items-center justify-center rounded-lg bg-[linear-gradient(135deg,#3b82f6_0%,#2563eb_100%)] text-white transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60"
            aria-label="新增客户"
          >
            {isCreatingClient ? (
              <LoaderCircle className="h-4 w-4 animate-spin" />
            ) : (
              <Plus className="h-4 w-4" />
            )}
          </button>
        </form>

        <div className="mt-4">
          <label className="block space-y-2">
            <span className="text-sm font-semibold text-slate-800">搜索已有客户</span>
            <div className="relative">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={managerSearch}
                onChange={(event) => setManagerSearch(event.target.value)}
                placeholder="输入关键词搜索客户"
                className="w-full rounded-lg border border-slate-200 bg-white px-10 py-2.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-300 focus:ring-4 focus:ring-blue-100"
              />
            </div>
          </label>
        </div>

        <div className="mt-4 flex items-center justify-between">
          <span className="text-sm font-semibold text-slate-900">已有客户</span>
          <span className="text-sm text-slate-400">{managedClients.length} 个客户</span>
        </div>

        <div className="mt-2.5 rounded-lg bg-slate-50/80 p-1.5">
          {isClientsLoading ? (
            <div className="flex items-center gap-2 px-3 py-4 text-sm text-slate-500">
              <LoaderCircle className="h-4 w-4 animate-spin" />
              正在同步客户列表...
            </div>
          ) : managedClients.length === 0 ? (
            <div className="px-3 py-6 text-sm leading-6 text-slate-500">
              当前没有匹配的客户结果。
            </div>
          ) : (
            <div className="max-h-[300px] space-y-1.5 overflow-y-auto pr-1">
              {managedClients.map((client) => (
                <div
                  key={client.id}
                  className="group flex items-center justify-between gap-3 rounded-md bg-white px-3.5 py-2.5 transition hover:bg-slate-50"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-900">
                      {client.name}
                    </p>
                    <p className="mt-1 text-xs text-slate-400">受控客户主数据</p>
                  </div>

                  <button
                    type="button"
                    onClick={() => void handleDeleteClient(client)}
                    disabled={deletingClientId === client.id}
                    className="pointer-events-none inline-flex items-center gap-1.5 rounded-md border border-red-200 bg-red-50 px-2.5 py-1.5 text-xs font-medium text-red-700 opacity-0 transition group-hover:pointer-events-auto group-hover:opacity-100 disabled:pointer-events-none disabled:opacity-60"
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
      </aside>
    </div>
  )
}
