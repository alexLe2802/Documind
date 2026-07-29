import { getFirebaseAuth } from './firebase'
import { clearStoredAuthToken, getStoredAuthToken, notifyUnauthorized, setStoredAuthToken } from './auth-token'

export function normalizeApiBaseUrl(value: string) {
  const baseUrl = value.replace(/\/+$/, '')
  return baseUrl.endsWith('/api') ? baseUrl : `${baseUrl}/api`
}

// Keep browser requests on the frontend origin. Next.js proxies /api to the
// configured backend, so transient upstream responses cannot be hidden by the
// browser as CORS failures.
export const API_BASE_URL = '/api'

export async function getApiAuthorizationToken() {
  const firebaseAuth = getFirebaseAuth()
  if (firebaseAuth.currentUser) {
    const token = await firebaseAuth.currentUser.getIdToken()
    setStoredAuthToken(token)
    return token
  }
  return getStoredAuthToken()
}

type RequestOptions = Omit<RequestInit, 'body'> & {
  body?: BodyInit | Record<string, unknown> | null
}

type ApiEnvelope<T> = {
  success: boolean
  data?: T
  meta?: {
    page: number
    limit: number
    totalItems: number
    totalPages: number
    hasNext: boolean
    hasPrevious: boolean
  }
  error?: {
    code?: string
    message?: string
    details?: unknown
  }
  timestamp?: string
  path?: string
  requestId?: string | null
}

export class ApiError extends Error {
  status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers = new Headers(options.headers)
  let body = options.body
  if (!headers.has('Authorization')) {
    const token = await getApiAuthorizationToken()
    if (token) {
      headers.set('Authorization', `Bearer ${token}`)
    }
  }

  if (body && !(body instanceof FormData) && typeof body !== 'string') {
    headers.set('Content-Type', 'application/json')
    body = JSON.stringify(body)
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    body,
    headers,
    credentials: 'include',
  })

  if (response.status === 204) {
    return undefined as T
  }

  const contentType = response.headers.get('content-type')
  const data = (contentType?.includes('application/json') ? await response.json() : null) as ApiEnvelope<T> | T | null

  if (!response.ok) {
    const message =
      data && typeof data === 'object' && 'error' in data
        ? data.error?.message ?? 'Request failed'
        : 'Request failed'

    if (response.status === 401) {
      clearStoredAuthToken()
      notifyUnauthorized()
    }

    throw new ApiError(message, response.status)
  }

  if (data && typeof data === 'object' && 'success' in data && data.success) {
    if (data.meta && Array.isArray(data.data)) {
      return {
        items: data.data,
        meta: data.meta,
      } as T
    }

    return data.data as T
  }

  return data as T
}
