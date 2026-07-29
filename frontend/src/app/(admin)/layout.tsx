import type { ReactNode } from 'react'
import { AppLayout } from '../../layouts/AppLayout'
import { ProtectedRoute } from '../../features/auth/ProtectedRoute'
import '../../quan-tri/admin-style.css'

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <ProtectedRoute allowedRoles={['ADMIN']}>
      <AppLayout>{children}</AppLayout>
    </ProtectedRoute>
  )
}
