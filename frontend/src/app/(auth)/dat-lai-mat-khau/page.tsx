import { Suspense } from 'react'
import { ResetPasswordView } from '../../../views/ResetPasswordView'

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div className="screen-message">Loading reset form...</div>}>
      <ResetPasswordView />
    </Suspense>
  )
}
