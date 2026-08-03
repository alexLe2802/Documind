import { act, render, screen } from '@testing-library/react'
import type { User } from 'firebase/auth'
import { AuthProvider } from './AuthProvider'
import { useAuth } from './useAuth'
import * as authApi from '../../api/auth.api'

let tokenListener: ((user: User | null) => Promise<void>) | undefined

vi.mock('firebase/auth', () => ({
  onIdTokenChanged: vi.fn((_auth, listener) => {
    tokenListener = listener
    return vi.fn()
  }),
  signInWithPopup: vi.fn(),
  signOut: vi.fn(),
}))

vi.mock('../../lib/firebase', () => ({
  getFirebaseAuth: () => ({ currentUser: null }),
  getGoogleAuthProvider: vi.fn(),
}))

vi.mock('../../api/auth.api', () => ({
  getCurrentUser: vi.fn(),
  loginWithFirebaseToken: vi.fn(),
  login: vi.fn(),
  register: vi.fn(),
}))

vi.mock('../../api/profile.api', () => ({ updateProfile: vi.fn() }))

function SessionProbe() {
  const { isLoading, user } = useAuth()
  return <div>{isLoading ? 'checking' : user?.email ?? 'signed-out'}</div>
}

describe('AuthProvider session restore', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.clearAllMocks()
    tokenListener = undefined
  })

  afterEach(() => vi.useRealTimers())

  it('stops blocking the page when Firebase session restore stalls', () => {
    render(<AuthProvider><SessionProbe /></AuthProvider>)
    expect(screen.getByText('checking')).toBeInTheDocument()

    act(() => vi.advanceTimersByTime(8_000))

    expect(screen.getByText('signed-out')).toBeInTheDocument()
  })

  it('does not show the full-page loading state again on token refresh', async () => {
    vi.mocked(authApi.loginWithFirebaseToken).mockResolvedValue({
      id: 'user-id',
      email: 'student@example.com',
      fullName: 'Student',
      avatarUrl: null,
      role: 'USER',
      status: 'ACTIVE',
      createdAt: '2026-08-03T00:00:00.000Z',
      lastLogin: null,
    })
    const firebaseUser = { getIdToken: vi.fn().mockResolvedValue('token') } as unknown as User
    render(<AuthProvider><SessionProbe /></AuthProvider>)

    await act(async () => { await tokenListener?.(firebaseUser) })
    expect(screen.getByText('student@example.com')).toBeInTheDocument()

    let resolveRefresh!: () => void
    vi.mocked(authApi.loginWithFirebaseToken).mockImplementationOnce(
      () => new Promise((resolve) => { resolveRefresh = () => resolve({} as never) }),
    )
    let refreshPromise: Promise<void> | undefined
    await act(async () => {
      refreshPromise = tokenListener?.(firebaseUser)
      await Promise.resolve()
    })

    expect(screen.queryByText('checking')).not.toBeInTheDocument()
    resolveRefresh()
    await act(async () => { await refreshPromise })
  })
})
