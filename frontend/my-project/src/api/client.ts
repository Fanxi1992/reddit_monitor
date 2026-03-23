import axios from 'axios'

// 默认采用同域部署：
// - /api 由 Nginx 反代给 FastAPI
// - /static 由 Nginx 反代给 FastAPI 的静态文件挂载
// 如有特殊环境，可用 Vite 环境变量覆盖。
export const BACKEND_BASE_URL = import.meta.env.VITE_API_BASE_URL?.trim() || '/api'
export const BACKEND_ASSET_BASE_URL =
  import.meta.env.VITE_ASSET_BASE_URL?.trim() || ''

export type PostType = '原创' | '代发' | '其他'
export type PostStatusFilter = 'all' | 'normal' | 'ban'
export type PostTypeFilter = 'all' | PostType
export type PostMetricFilter = 'all' | 'lte_5' | 'lte_10' | 'lte_15'

export const POST_TYPE_OPTIONS: PostType[] = ['原创', '代发', '其他']
export const POST_STATUS_FILTER_OPTIONS: Array<{
  label: string
  value: PostStatusFilter
}> = [
  { label: '全部', value: 'all' },
  { label: 'Normal', value: 'normal' },
  { label: 'Ban', value: 'ban' },
]
export const POST_TYPE_FILTER_OPTIONS: Array<{
  label: string
  value: PostTypeFilter
}> = [
  { label: '全部', value: 'all' },
  { label: '原创', value: '原创' },
  { label: '代发', value: '代发' },
  { label: '其他', value: '其他' },
]
export const POST_METRIC_FILTER_OPTIONS: Array<{
  label: string
  value: PostMetricFilter
}> = [
  { label: '全部', value: 'all' },
  { label: '小于等于 5', value: 'lte_5' },
  { label: '小于等于 10', value: 'lte_10' },
  { label: '小于等于 15', value: 'lte_15' },
]

export const apiClient = axios.create({
  baseURL: BACKEND_BASE_URL,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
  },
})

export interface ClientResponse {
  id: number
  name: string
  created_at: string
}

export interface CreateClientPayload {
  name: string
}

export interface CreatePostPayload {
  url: string
  title: string
  client_id: number
  post_type?: PostType
  operator_note: string | null
}

export interface PostResponse {
  id: number
  reddit_id: string
  url: string
  title: string
  post_type: PostType
  client_id: number | null
  client_name: string | null
  operator_note: string | null
  operator_note_updated_at: string | null
  status: string
  latest_upvotes: number | null
  latest_comments: number | null
  last_scraped_at: string | null
  is_archived: boolean
  archived_at: string | null
  created_at: string
}

export interface ScreenshotResponse {
  id: number
  post_id: number
  day_mark: number
  file_path: string
  captured_at: string
}

export interface NoteUpdatePayload {
  operator_note: string
}

export interface PostListParams {
  client_id?: number
  archived?: boolean
  unassigned?: boolean
  status_filter?: PostStatusFilter
  post_type?: PostTypeFilter
  upvotes_filter?: PostMetricFilter
  comments_filter?: PostMetricFilter
  client_keyword?: string
  title_keyword?: string
}

export async function fetchPosts(params?: PostListParams) {
  const response = await apiClient.get<PostResponse[]>('/posts/', { params })

  if (!Array.isArray(response.data)) {
    throw new Error('帖子列表响应格式异常。')
  }

  return response.data
}

export async function updatePostNote(
  postId: number,
  payload: NoteUpdatePayload,
) {
  const response = await apiClient.put<PostResponse>(`/posts/${postId}/note`, payload)
  return response.data
}

export async function archivePost(postId: number) {
  const response = await apiClient.post<PostResponse>(`/posts/${postId}/archive`)
  return response.data
}

export function buildBackendAssetUrl(filePath: string) {
  const normalizedPath = filePath.replace(/^\/+/, '')

  if (/^https?:\/\//i.test(normalizedPath)) {
    return normalizedPath
  }

  if (BACKEND_ASSET_BASE_URL) {
    return new URL(
      `/${normalizedPath}`,
      BACKEND_ASSET_BASE_URL.endsWith('/')
        ? BACKEND_ASSET_BASE_URL
        : `${BACKEND_ASSET_BASE_URL}/`,
    ).toString()
  }

  return `/${normalizedPath}`
}

export function getApiErrorMessage(
  error: unknown,
  fallback = '请求失败，请稍后重试。',
) {
  if (axios.isAxiosError(error)) {
    const detail = error.response?.data?.detail

    if (typeof detail === 'string' && detail.trim()) {
      return detail
    }
  }

  return fallback
}
