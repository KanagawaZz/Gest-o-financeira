import { createElement, lazy, Suspense, type ComponentType, type ReactNode } from 'react'
import { Navigate, createBrowserRouter } from 'react-router-dom'
import { AppLayout } from '@/app/layouts/AppLayout'
import { NAV_ITEMS } from '@/app/navigation'
import { LoginPage } from '@/features/auth/LoginPage'
import { ProtectedRoute } from './ProtectedRoute'

function lazyRoute(loader: () => Promise<{ default: ComponentType }>): ReactNode {
  const Component = lazy(loader)
  return (
    <Suspense
      fallback={
        <div role="status" className="flex min-h-[40vh] items-center justify-center text-sm text-cinza-t">
          Carregando…
        </div>
      }
    >
      {createElement(Component)}
    </Suspense>
  )
}

// Uma página por item do menu (plano §3), carregadas sob demanda (code-splitting).
const PAGES: Record<string, ReactNode> = {
  '/': lazyRoute(() => import('@/features/dashboard/DashboardPage').then((m) => ({ default: m.DashboardPage }))),
  '/contas': lazyRoute(() => import('@/features/accounts/AccountsHubPage').then((m) => ({ default: m.AccountsHubPage }))),
  '/transacoes': lazyRoute(() => import('@/features/transactions/TransactionsPage').then((m) => ({ default: m.TransactionsPage }))),
  '/parcelamentos': lazyRoute(() => import('@/features/installments/InstallmentsPage').then((m) => ({ default: m.InstallmentsPage }))),
  '/cartoes': lazyRoute(() => import('@/features/cards/CardsPage').then((m) => ({ default: m.CardsPage }))),
  '/categorias': lazyRoute(() => import('@/features/categories/CategoriesPage').then((m) => ({ default: m.CategoriesPage }))),
  '/metas': lazyRoute(() => import('@/features/goals/GoalsPage').then((m) => ({ default: m.GoalsPage }))),
  '/relatorios': lazyRoute(() => import('@/features/reports/ReportsPage').then((m) => ({ default: m.ReportsPage }))),
  '/configuracoes': lazyRoute(() => import('@/features/settings/SettingsPage').then((m) => ({ default: m.SettingsPage }))),
}

export const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  { path: '/cadastro', element: lazyRoute(() => import('@/features/auth/RegisterPage').then((m) => ({ default: m.RegisterPage }))) },
  { path: '/recuperar-senha', element: lazyRoute(() => import('@/features/auth/ForgotPasswordPage').then((m) => ({ default: m.ForgotPasswordPage }))) },
  { path: '/redefinir-senha', element: lazyRoute(() => import('@/features/auth/ResetPasswordPage').then((m) => ({ default: m.ResetPasswordPage }))) },
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
