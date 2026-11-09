import type { ReactNode } from 'react'
import { Navigate, Outlet, createBrowserRouter } from 'react-router-dom'
import { AppLayout } from '@/app/layouts/AppLayout'
import { NAV_ITEMS } from '@/app/navigation'
import { AccountsHubPage } from '@/features/accounts/AccountsHubPage'
import { useAuth } from '@/features/auth/AuthProvider'
import { LoginPage } from '@/features/auth/LoginPage'
import { CardsPage } from '@/features/cards/CardsPage'
import { CategoriesPage } from '@/features/categories/CategoriesPage'
import { DashboardPage } from '@/features/dashboard/DashboardPage'
import { GoalsPage } from '@/features/goals/GoalsPage'
import { InstallmentsPage } from '@/features/installments/InstallmentsPage'
import { ReportsPage } from '@/features/reports/ReportsPage'
import { SettingsPage } from '@/features/settings/SettingsPage'
import { TransactionsPage } from '@/features/transactions/TransactionsPage'

function ProtectedRoute() {
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

// Uma página por item do menu (plano §3).
const PAGES: Record<string, ReactNode> = {
  '/': <DashboardPage />,
  '/contas': <AccountsHubPage />,
  '/transacoes': <TransactionsPage />,
  '/parcelamentos': <InstallmentsPage />,
  '/cartoes': <CardsPage />,
  '/categorias': <CategoriesPage />,
  '/metas': <GoalsPage />,
  '/relatorios': <ReportsPage />,
  '/configuracoes': <SettingsPage />,
}

export const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  {
    element: <ProtectedRoute />,
    children: [
      {
        element: <AppLayout />,
        children: NAV_ITEMS.map((item) => ({
          path: item.to,
          index: item.to === '/',
          element: PAGES[item.to],
        })),
      },
    ],
  },
  { path: '*', element: <Navigate to="/" replace /> },
])
