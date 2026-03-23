import axios from 'axios'

// 默认采用同域部署：
// - /api 由 Nginx 反代给 FastAPI
// - /static 由 Nginx 反代给 FastAPI 的静态文件挂载
// 如有特殊环境，可用 Vite 环境变量覆盖。
export const BACKEND_BASE_URL = import.meta.env.VITE_API_BASE_URL?.trim() || '/api'
export const BACKEND_ASSET_BASE_URL =
  import.meta.env.VITE_ASSET_BASE_URL?.trim() || ''

export type PostType = '原创' | '代发' | '其他'

export const POST_TYPE_OPTIONS: PostType[] = ['原创', '代发', '其他']

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
