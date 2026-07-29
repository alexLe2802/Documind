const AUTH_TOKEN_KEY = 'ai-study-hub.firebaseIdToken'

function canUseStorage() {
  return typeof window !== 'undefined' && typeof window.sessionStorage !== 'undefined'
}

export function getStoredAuthToken() {
  if (!canUseStorage()) return null
  return window.sessionStorage.getItem(AUTH_TOKEN_KEY)
}

export function setStoredAuthToken(token: string) {
  if (!canUseStorage()) return
  window.sessionStorage.setItem(AUTH_TOKEN_KEY, token)
}

export function clearStoredAuthToken() {
  if (!canUseStorage()) return
  window.sessionStorage.removeItem(AUTH_TOKEN_KEY)
}

export function notifyUnauthorized() {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new Event('ai-study-hub:unauthorized'))
}
