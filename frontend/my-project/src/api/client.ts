import axios from 'axios'

export const BACKEND_BASE_URL = 'http://127.0.0.1:8000/api'
export const BACKEND_ORIGIN = new URL(BACKEND_BASE_URL).origin

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
  return `${BACKEND_ORIGIN}/${normalizedPath}`
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
