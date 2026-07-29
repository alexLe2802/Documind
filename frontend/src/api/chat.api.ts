import { apiRequest } from '../lib/http'
import type { AiChatResponse, ChatMessageListResponse, ChatSessionListResponse, LibraryFilters } from '../types/chat'

export function askDocument(payload: {
  documentId: string
  question: string
  sessionId?: string
}) {
  return apiRequest<AiChatResponse>('/chat/ask-document', {
    method: 'POST',
    body: payload,
  })
}

export function askLibrary(payload: {
  question: string
  filters?: LibraryFilters
  sessionId?: string
}) {
  return apiRequest<AiChatResponse>('/chat/ask-library', {
    method: 'POST',
    body: payload,
  })
}

export async function askLibraryStream(
  payload: {
    question: string
    filters?: LibraryFilters
    sessionId?: string
  },
  handlers: {
    onSources?: (sources: AiChatResponse['sources']) => void
    onDelta?: (delta: string) => void
  },
  signal?: AbortSignal,
) {
  if (signal?.aborted) throw new DOMException('The request was aborted', 'AbortError')
  const response = await askLibrary(payload)
  if (signal?.aborted) throw new DOMException('The request was aborted', 'AbortError')
  handlers.onSources?.(response.sources)
  handlers.onDelta?.(response.answer)
  return response
}

export function fetchChatSessions(query: number | { mode?: 'ASK_MY_LIBRARY' | 'ASK_THIS_DOCUMENT'; limit?: number } = 2) {
  const options = typeof query === 'number' ? { limit: query } : query
  const params = new URLSearchParams({ page: '1', limit: String(options.limit ?? 2) })
  if (options.mode) params.set('mode', options.mode)
  return apiRequest<ChatSessionListResponse>(`/chat/sessions?${params}`)
}

export function fetchChatMessages(sessionId: string, limit = 100) {
  return apiRequest<ChatMessageListResponse>(
    `/chat/messages/${sessionId}?page=1&limit=${limit}`,
  )
}
