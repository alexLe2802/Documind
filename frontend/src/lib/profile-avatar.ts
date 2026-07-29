import { getDownloadURL, ref, uploadBytes } from 'firebase/storage'
import { getFirebaseStorage } from './firebase'

export const AVATAR_MAX_SIZE = 5 * 1024 * 1024
export const AVATAR_ACCEPT = 'image/jpeg,image/png,image/webp,image/gif'

const ALLOWED_AVATAR_TYPES = new Set(AVATAR_ACCEPT.split(','))

export function validateAvatarFile(file: File): 'type' | 'size' | null {
  if (!ALLOWED_AVATAR_TYPES.has(file.type)) return 'type'
  if (file.size > AVATAR_MAX_SIZE) return 'size'
  return null
}

export async function uploadProfileAvatar(userId: string, file: File) {
  const safeName = file.name
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(-120)
  const objectRef = ref(
    getFirebaseStorage(),
    `avatars/${userId}/${Date.now()}-${safeName || 'avatar'}`,
  )

  await uploadBytes(objectRef, file, {
    contentType: file.type,
    cacheControl: 'public,max-age=31536000,immutable',
  })

  return getDownloadURL(objectRef)
}
