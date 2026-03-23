import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'

import {
  archivePost,
  DEFAULT_PAGE_SIZE,
  fetchPostsPage,
  getApiErrorMessage,
  unarchivePost,
  updatePostNote,
  type PostListParams,
  type PostResponse,
} from '../api/client'
import Modal from '../components/Modal'
import PaginationControls from '../components/PaginationControls'
import PostManagementFilters, {
  type PostManagementFilterDraft,
} from '../components/PostManagementFilters'
import PostManagementTable from '../components/PostManagementTable'

const MAX_NOTE_LENGTH = 300

const DEFAULT_FILTERS: PostManagementFilterDraft = {
  status_filter: 'all',
  post_type: 'all',
  upvotes_filter: 'all',
  comments_filter: 'all',
  client_keyword: '',
  title_keyword: '',
}

type PostWorkspaceMode = 'active' | 'archived'

interface PostWorkspaceProps {
  mode: PostWorkspaceMode
}

interface WorkspaceCopy {
  actionVariant: 'archive' | 'unarchive'
  actionSuccessMessage: string
  actionErrorMessage: string
  confirmTitle: string
  confirmDescription: string
  confirmBody: string
  confirmButtonLabel: string
  confirmButtonLoadingLabel: string
}

interface PaginationState {
  page: number
  pageSize: number
  totalCount: number
  totalPages: number
}

const WORKSPACE_COPY: Record<PostWorkspaceMode, WorkspaceCopy> = {
  active: {
    actionVariant: 'archive',
    actionSuccessMessage: '帖子已归档。',
    actionErrorMessage: '帖子归档失败，请稍后重试。',
    confirmTitle: '确认归档',
    confirmDescription: '归档后的帖子将移动到“归档帖子”页面，原有历史数据不会被删除。',
    confirmBody: '确定要归档这条帖子吗？归档后它会从当前“帖子管理”列表中移除。',
    confirmButtonLabel: '确认归档',
    confirmButtonLoadingLabel: '归档中...',
  },
  archived: {
    actionVariant: 'unarchive',
    actionSuccessMessage: '帖子已取消归档。',
    actionErrorMessage: '取消归档失败，请稍后重试。',
    confirmTitle: '确认取消归档',
    confirmDescription: '取消归档后，这条帖子会返回“帖子管理”页面，并重新出现在未归档列表中。',
    confirmBody: '确定要取消归档这条帖子吗？帖子将移回到“帖子管理”页面。',
    confirmButtonLabel: '确认取消归档',
    confirmButtonLoadingLabel: '取消归档中...',
  },
}

function buildPostListParams(
  filters: PostManagementFilterDraft,
  mode: PostWorkspaceMode,
): PostListParams {
  return {
    archived: mode === 'archived',
    status_filter: filters.status_filter,
    post_type: filters.post_type,
    upvotes_filter: filters.upvotes_filter,
    comments_filter: filters.comments_filter,
    client_keyword: filters.client_keyword.trim() || undefined,
    title_keyword: filters.title_keyword.trim() || undefined,
  }
}

function normalizeNoteForSave(note: string) {
  return note.trim()
}

function createDefaultPaginationState(): PaginationState {
  return {
    page: 1,
    pageSize: DEFAULT_PAGE_SIZE,
    totalCount: 0,
    totalPages: 0,
  }
}

export default function PostWorkspace({ mode }: PostWorkspaceProps) {
  const [posts, setPosts] = useState<PostResponse[]>([])
  const [filterDraft, setFilterDraft] = useState<PostManagementFilterDraft>(DEFAULT_FILTERS)
  const [appliedFilters, setAppliedFilters] = useState<PostManagementFilterDraft>(DEFAULT_FILTERS)
  const [pagination, setPagination] = useState<PaginationState>(createDefaultPaginationState)
  const [isLoading, setIsLoading] = useState(true)
  const [activeNotePost, setActiveNotePost] = useState<PostResponse | null>(null)
  const [noteDraft, setNoteDraft] = useState('')
  const [isSavingNote, setIsSavingNote] = useState(false)
  const [actionTargetPost, setActionTargetPost] = useState<PostResponse | null>(null)
  const [isSubmittingAction, setIsSubmittingAction] = useState(false)

  const copy = WORKSPACE_COPY[mode]

  useEffect(() => {
    setFilterDraft(DEFAULT_FILTERS)
    setAppliedFilters(DEFAULT_FILTERS)
    setPagination(createDefaultPaginationState())

    let isCancelled = false

    async function initializeWorkspace() {
      setIsLoading(true)

      try {
        const nextPage = await fetchPostsPage({
          ...buildPostListParams(DEFAULT_FILTERS, mode),
          page: 1,
          page_size: DEFAULT_PAGE_SIZE,
        })
        if (!isCancelled) {
          setPosts(nextPage.items)
          setPagination({
            page: nextPage.page,
            pageSize: nextPage.page_size,
            totalCount: nextPage.total_count,
            totalPages: nextPage.total_pages,
          })
        }
      } catch (error) {
        if (!isCancelled) {
          toast.error(getApiErrorMessage(error, '帖子列表加载失败，请稍后重试。'))
          setPosts([])
          setPagination(createDefaultPaginationState())
        }
      } finally {
        if (!isCancelled) {
          setIsLoading(false)
        }
      }
    }

    void initializeWorkspace()

    return () => {
      isCancelled = true
    }
  }, [mode])

  function updateFilterDraft<Key extends keyof PostManagementFilterDraft>(
    field: Key,
    nextValue: PostManagementFilterDraft[Key],
  ) {
    setFilterDraft((current) => ({
      ...current,
      [field]: nextValue,
    }))
  }

  async function loadPosts(
    filters: PostManagementFilterDraft,
    page: number,
  ) {
    setIsLoading(true)

    try {
      const nextPage = await fetchPostsPage({
        ...buildPostListParams(filters, mode),
        page,
        page_size: DEFAULT_PAGE_SIZE,
      })

      if (page > 1 && nextPage.total_pages > 0 && page > nextPage.total_pages) {
        await loadPosts(filters, nextPage.total_pages)
        return
      }

      setAppliedFilters(filters)
      setPosts(nextPage.items)
      setPagination({
        page: nextPage.total_pages === 0 ? 1 : nextPage.page,
        pageSize: nextPage.page_size,
        totalCount: nextPage.total_count,
        totalPages: nextPage.total_pages,
      })
    } catch (error) {
      toast.error(getApiErrorMessage(error, '帖子列表加载失败，请稍后重试。'))
      setPosts([])
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
    await loadPosts(filterDraft, 1)
  }

  async function handleResetFilters() {
    setFilterDraft(DEFAULT_FILTERS)
    await loadPosts(DEFAULT_FILTERS, 1)
  }

  async function handlePageChange(nextPage: number) {
    if (nextPage < 1 || nextPage === pagination.page || isLoading) {
      return
    }

    await loadPosts(appliedFilters, nextPage)
  }

  async function handleCopyLink(post: PostResponse) {
    try {
      await navigator.clipboard.writeText(post.url)
      toast.success('帖子链接已复制。')
    } catch {
      toast.error('复制失败，请检查浏览器权限。')
    }
  }

  function handleOpenNoteModal(post: PostResponse) {
    setActiveNotePost(post)
    setNoteDraft(post.operator_note ?? '')
  }

  async function handleSaveNote() {
    if (!activeNotePost) {
      return
    }

    const normalizedDraft = normalizeNoteForSave(noteDraft)
    const originalNote = activeNotePost.operator_note ?? ''

    if (normalizedDraft === originalNote) {
      setActiveNotePost(null)
      return
    }

    setIsSavingNote(true)

    try {
      const updatedPost = await updatePostNote(activeNotePost.id, {
        operator_note: normalizedDraft,
      })

      setPosts((currentPosts) =>
        currentPosts.map((post) => (post.id === updatedPost.id ? updatedPost : post)),
      )
      setActiveNotePost(null)
      toast.success('运营备注已更新。')
    } catch (error) {
      toast.error(getApiErrorMessage(error, '备注更新失败，请稍后重试。'))
    } finally {
      setIsSavingNote(false)
    }
  }

  function handleOpenActionModal(post: PostResponse) {
    setActionTargetPost(post)
  }

  async function handleConfirmAction() {
    if (!actionTargetPost) {
      return
    }

    setIsSubmittingAction(true)

    try {
      if (mode === 'archived') {
        await unarchivePost(actionTargetPost.id)
      } else {
        await archivePost(actionTargetPost.id)
      }

      await loadPosts(appliedFilters, pagination.page)
      setActionTargetPost(null)
      toast.success(copy.actionSuccessMessage)
    } catch (error) {
      toast.error(getApiErrorMessage(error, copy.actionErrorMessage))
    } finally {
      setIsSubmittingAction(false)
    }
  }

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-end text-sm font-medium text-slate-700">
        {pagination.totalCount} 条帖子
      </div>

      <div className="border border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-4 py-3">
          <PostManagementFilters
            value={filterDraft}
            isSubmitting={isLoading}
            onChange={updateFilterDraft}
            onApply={() => void handleApplyFilters()}
            onReset={() => void handleResetFilters()}
          />
        </div>

        <PostManagementTable
          posts={posts}
          isLoading={isLoading}
          actionVariant={copy.actionVariant}
          onCopyLink={handleCopyLink}
          onEditNote={handleOpenNoteModal}
          onAction={handleOpenActionModal}
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

      <Modal
        open={activeNotePost !== null}
        title="编辑运营备注"
        description="保存后系统会自动刷新这条备注的最新时间戳。"
        onClose={() => {
          if (isSavingNote) {
            return
          }
          setActiveNotePost(null)
        }}
        maxWidthClassName="max-w-2xl"
      >
        <div className="space-y-4">
          <textarea
            rows={7}
            maxLength={MAX_NOTE_LENGTH}
            value={noteDraft}
            onChange={(event) => setNoteDraft(event.target.value)}
            placeholder="填写运营备注"
            className="w-full rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm leading-6 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-300 focus:ring-4 focus:ring-blue-100"
          />

          <div className="flex items-center justify-between text-sm text-slate-500">
            <span>备注超长会在表格中自动截断，点击后可查看完整内容。</span>
            <span>{noteDraft.length}/{MAX_NOTE_LENGTH}</span>
          </div>

          <div className="flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => setActiveNotePost(null)}
              disabled={isSavingNote}
              className="inline-flex h-10 items-center justify-center rounded-md border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              取消
            </button>
            <button
              type="button"
              onClick={() => void handleSaveNote()}
              disabled={isSavingNote}
              className="inline-flex h-10 items-center justify-center rounded-md bg-blue-600 px-5 text-sm font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSavingNote ? '保存中...' : '保存'}
            </button>
          </div>
        </div>
      </Modal>

      <Modal
        open={actionTargetPost !== null}
        title={copy.confirmTitle}
        description={copy.confirmDescription}
        onClose={() => {
          if (isSubmittingAction) {
            return
          }
          setActionTargetPost(null)
        }}
        maxWidthClassName="max-w-xl"
      >
        <div className="space-y-5">
          <div className="text-sm leading-7 text-slate-600">{copy.confirmBody}</div>

          <div className="rounded-md border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
            <span className="font-semibold text-slate-900">帖子标题：</span>
            <span className="ml-1">{actionTargetPost?.title ?? '--'}</span>
          </div>

          <div className="flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => setActionTargetPost(null)}
              disabled={isSubmittingAction}
              className="inline-flex h-10 items-center justify-center rounded-md border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              取消
            </button>
            <button
              type="button"
              onClick={() => void handleConfirmAction()}
              disabled={isSubmittingAction}
              className={[
                'inline-flex h-10 items-center justify-center rounded-md px-5 text-sm font-medium text-white transition disabled:cursor-not-allowed disabled:opacity-60',
                mode === 'archived'
                  ? 'bg-emerald-600 hover:bg-emerald-700'
                  : 'bg-amber-500 hover:bg-amber-600',
              ].join(' ')}
            >
              {isSubmittingAction
                ? copy.confirmButtonLoadingLabel
                : copy.confirmButtonLabel}
            </button>
          </div>
        </div>
      </Modal>
    </section>
  )
}
