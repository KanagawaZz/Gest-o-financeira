import { lazy, Suspense, type ReactNode } from 'react'
import { Navigate, createBrowserRouter } from 'react-router-dom'
import { AppLayout } from '@/app/layouts/AppLayout'
import { NAV_ITEMS } from '@/app/navigation'
import { LoginPage } from '@/features/auth/LoginPage'
import { DashboardPage } from '@/features/dashboard/DashboardPage'
import { ProtectedRoute } from './ProtectedRoute'

// Páginas de autenticação secundárias sob demanda
const RegisterPage = lazy(() => import('@/features/auth/RegisterPage').then((m) => ({ default: m.RegisterPage })))
const ForgotPasswordPage = lazy(() => import('@/features/auth/ForgotPasswordPage').then((m) => ({ default: m.ForgotPasswordPage })))
const ResetPasswordPage = lazy(() => import('@/features/auth/ResetPasswordPage').then((m) => ({ default: m.ResetPasswordPage })))

// Páginas internas sob demanda (code-splitting para performance móvel)
const AccountsHubPage = lazy(() => import('@/features/accounts/AccountsHubPage').then((m) => ({ default: m.AccountsHubPage })))
const TransactionsPage = lazy(() => import('@/features/transactions/TransactionsPage').then((m) => ({ default: m.TransactionsPage })))
const InstallmentsPage = lazy(() => import('@/features/installments/InstallmentsPage').then((m) => ({ default: m.InstallmentsPage })))
const CardsPage = lazy(() => import('@/features/cards/CardsPage').then((m) => ({ default: m.CardsPage })))
const CategoriesPage = lazy(() => import('@/features/categories/CategoriesPage').then((m) => ({ default: m.CategoriesPage })))
const GoalsPage = lazy(() => import('@/features/goals/GoalsPage').then((m) => ({ default: m.GoalsPage })))
const ReportsPage = lazy(() => import('@/features/reports/ReportsPage').then((m) => ({ default: m.ReportsPage })))
const SettingsPage = lazy(() => import('@/features/settings/SettingsPage').then((m) => ({ default: m.SettingsPage })))

function PageSuspense({ children }: { children: ReactNode }) {
  return (
    <Suspense
      fallback={
        <div role="status" className="flex min-h-[40vh] items-center justify-center text-sm text-cinza-t">
          Carregando…
        </div>
      }
    >
      {children}
    </Suspense>
  )
}

// Uma página por item do menu (plano §3). Dashboard é estático (rota principal).
const PAGES: Record<string, ReactNode> = {
  '/': <DashboardPage />,
  '/contas': <PageSuspense><AccountsHubPage /></PageSuspense>,
  '/transacoes': <PageSuspense><TransactionsPage /></PageSuspense>,
  '/parcelamentos': <PageSuspense><InstallmentsPage /></PageSuspense>,
  '/cartoes': <PageSuspense><CardsPage /></PageSuspense>,
  '/categorias': <PageSuspense><CategoriesPage /></PageSuspense>,
  '/metas': <PageSuspense><GoalsPage /></PageSuspense>,
  '/relatorios': <PageSuspense><ReportsPage /></PageSuspense>,
  '/configuracoes': <PageSuspense><SettingsPage /></PageSuspense>,
}

export const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  { path: '/cadastro', element: <PageSuspense><RegisterPage /></PageSuspense> },
  { path: '/recuperar-senha', element: <PageSuspense><ForgotPasswordPage /></PageSuspense> },
  { path: '/redefinir-senha', element: <PageSuspense><ResetPasswordPage /></PageSuspense> },
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
