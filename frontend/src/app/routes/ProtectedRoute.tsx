import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '@/features/auth/AuthProvider'

export function ProtectedRoute() {
  const { user, loading } = useAuth()
  if (loading) {
    return (
      <div role="status" className="flex min-h-full items-center justify-center text-sm text-cinza-t">
        Carregando…
      </div>
    )
  }
  return user ? <Outlet /> : <Navigate to="/login" replace />
}

