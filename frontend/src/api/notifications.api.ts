import { apiRequest } from '../lib/http'

export type UserNotification = {
  id: string
  type: 'DOCUMENT_UPLOADED' | 'DOCUMENT_PENDING_REVIEW' | 'DOCUMENT_PUBLISHED' | 'DOCUMENT_APPROVED' | 'DOCUMENT_REJECTED'
  title: string
  message: string
  documentId: string | null
  isRead: boolean
  createdAt: string
  readAt: string | null
}

export type NotificationsResponse = {
  items: UserNotification[]
  unreadCount: number
}

export function getNotifications(limit = 20) {
  return apiRequest<NotificationsResponse>(`/notifications?limit=${limit}`)
}

export function markNotificationRead(id: string) {
  return apiRequest<void>(`/notifications/${id}/read`, { method: 'PATCH' })
}

export function markAllNotificationsRead() {
  return apiRequest<void>('/notifications/read-all', { method: 'PATCH' })
}
