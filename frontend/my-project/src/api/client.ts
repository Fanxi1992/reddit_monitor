import axios from 'axios'

// 前端线上默认与后端部署在同一域名下，由 Nginx 反代 /api 和 /static。
// 因此默认使用相对路径，避免把请求错误地打到浏览器本机的 127.0.0.1。
// 如有特殊环境，也可以通过 Vite 环境变量覆盖：
// - VITE_API_BASE_URL
// - VITE_ASSET_BASE_URL
export const BACKEND_BASE_URL = import.meta.env.VITE_API_BASE_URL?.trim() || '/api'
export const BACKEND_ASSET_BASE_URL =
  import.meta.env.VITE_ASSET_BASE_URL?.trim() || ''

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
  operator_note: string | null
}

export interface PostResponse {
  id: number
  reddit_id: string
  url: string
  title: string
  client_id: number | null
  client_name: string | null
  operator_note: string | null
  status: string
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

  // 优先使用显式配置的静态资源域名；若未配置，则默认走当前站点同域名。
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
