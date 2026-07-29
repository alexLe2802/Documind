import type { ReactNode } from 'react'
import { AuthLayout } from '../../layouts/AuthLayout'

export default function AuthRouteLayout({ children }: { children: ReactNode }) {
  return <AuthLayout>{children}</AuthLayout>
}
