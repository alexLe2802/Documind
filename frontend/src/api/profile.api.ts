import { apiRequest } from '../lib/http'
import type { UserProfile, UpdateProfilePayload } from '../types/auth'

export function getProfile() {
  return apiRequest<UserProfile>('/users/profile')
}

export function updateProfile(payload: UpdateProfilePayload) {
  return apiRequest<UserProfile>('/users/profile', {
    method: 'PATCH',
    body: payload,
  })
}
