import {
  clearStoredAuthToken,
  getStoredAuthToken,
  notifyUnauthorized,
  setStoredAuthToken,
} from './auth-token'

describe('auth token storage', () => {
  beforeEach(() => {
    window.sessionStorage.clear()
  })

  it('stores, reads, and clears the Firebase ID token in session storage', () => {
    setStoredAuthToken('firebase-token')

    expect(getStoredAuthToken()).toBe('firebase-token')

    clearStoredAuthToken()

    expect(getStoredAuthToken()).toBeNull()
  })

  it('notifies the auth provider when authentication is invalid', () => {
    const listener = vi.fn()
    window.addEventListener('ai-study-hub:unauthorized', listener)

    notifyUnauthorized()

    expect(listener).toHaveBeenCalledOnce()
    window.removeEventListener('ai-study-hub:unauthorized', listener)
  })
})
