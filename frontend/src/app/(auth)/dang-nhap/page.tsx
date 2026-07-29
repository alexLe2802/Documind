import { Suspense } from 'react'
import { LoginView } from '../../../views/LoginView'

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="screen-message">Loading...</div>}>
      <LoginView />
    </Suspense>
  )
}
