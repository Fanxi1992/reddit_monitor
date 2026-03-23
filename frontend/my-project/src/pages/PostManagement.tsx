import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'

import {
  archivePost,
  fetchPosts,
  getApiErrorMessage,
  updatePostNote,
  type PostListParams,
  type PostResponse,
} from '../api/client'
import Modal from '../components/Modal'
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

function buildPostListParams(filters: PostManagementFilterDraft): PostListParams {
  return {
    archived: false,
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

export default function PostManagement() {
  const [posts, setPosts] = useState<PostResponse[]>([])
  const [filterDraft, setFilterDraft] = useState<PostManagementFilterDraft>(DEFAULT_FILTERS)
  const [isLoading, setIsLoading] = useState(true)
  const [activeNotePost, setActiveNotePost] = useState<PostResponse | null>(null)
  const [noteDraft, setNoteDraft] = useState('')
  const [isSavingNote, setIsSavingNote] = useState(false)
  const [archiveTargetPost, setArchiveTargetPost] = useState<PostResponse | null>(null)
  const [isArchivingPost, setIsArchivingPost] = useState(false)

  useEffect(() => {
    void loadPosts(DEFAULT_FILTERS)
  }, [])

  function updateFilterDraft<Key extends keyof PostManagementFilterDraft>(
    field: Key,
    nextValue: PostManagementFilterDraft[Key],
  ) {
    setFilterDraft((current) => ({
      ...current,
      [field]: nextValue,
    }))
  }

  async function loadPosts(filters: PostManagementFilterDraft) {
    setIsLoading(true)

    try {
      const nextPosts = await fetchPosts(buildPostListParams(filters))
      setPosts(nextPosts)
    } catch (error) {
      toast.error(getApiErrorMessage(error, '帖子列表加载失败，请稍后重试。'))
      setPosts([])
    } finally {
      setIsLoading(false)
    }
  }

  async function handleApplyFilters() {
    await loadPosts(filterDraft)
  }

  async function handleResetFilters() {
    setFilterDraft(DEFAULT_FILTERS)
    await loadPosts(DEFAULT_FILTERS)
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

  function handleOpenArchiveModal(post: PostResponse) {
    setArchiveTargetPost(post)
  }

  async function handleConfirmArchive() {
    if (!archiveTargetPost) {
      return
    }

    setIsArchivingPost(true)

    try {
      const archivedPost = await archivePost(archiveTargetPost.id)
      setPosts((currentPosts) =>
        currentPosts.filter((post) => post.id !== archivedPost.id),
      )
      setArchiveTargetPost(null)
      toast.success('帖子已归档。')
    } catch (error) {
      toast.error(getApiErrorMessage(error, '帖子归档失败，请稍后重试。'))
    } finally {
      setIsArchivingPost(false)
    }
  }

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-end text-sm font-medium text-slate-700">
        {posts.length} 条帖子
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
          onCopyLink={handleCopyLink}
          onEditNote={handleOpenNoteModal}
          onArchive={handleOpenArchiveModal}
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
        open={archiveTargetPost !== null}
        title="确认归档"
        description="归档后的帖子将移动到“归档帖子”页面，原有历史数据不会被删除。"
        onClose={() => {
          if (isArchivingPost) {
            return
          }
          setArchiveTargetPost(null)
        }}
        maxWidthClassName="max-w-xl"
      >
        <div className="space-y-5">
          <div className="text-sm leading-7 text-slate-600">
            确定要归档这条帖子吗？归档后它会从当前“帖子管理”列表中移除。
          </div>

          <div className="rounded-md border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
            <span className="font-semibold text-slate-900">帖子标题：</span>
            <span className="ml-1">{archiveTargetPost?.title ?? '--'}</span>
          </div>

          <div className="flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => setArchiveTargetPost(null)}
              disabled={isArchivingPost}
              className="inline-flex h-10 items-center justify-center rounded-md border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              取消
            </button>
            <button
              type="button"
              onClick={() => void handleConfirmArchive()}
              disabled={isArchivingPost}
              className="inline-flex h-10 items-center justify-center rounded-md bg-amber-500 px-5 text-sm font-medium text-white transition hover:bg-amber-600 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isArchivingPost ? '归档中...' : '确认归档'}
            </button>
          </div>
        </div>
      </Modal>
    </section>
  )
}
