import type { Page, Transaction } from '@/types/finance'
import type {
  CardInput,
  Contribution,
  ContributionInput,
  CreditCard,
  DashboardSummary,
  InstallmentPlan,
  Invoice,
  InvoiceDetail,
  Onboarding,
  Goal,
  GoalInput,
  PlanInput,
  PlanPreview,
  PlansSummary,
  ProjectionMonth,
  PurchaseInput,
  RecurringInput,
  RecurringRule,
  Report,
  Simulation,
} from '@/types/planning'
import type { User } from '@/types/auth'
import { api } from './api'

function qs(params: Record<string, string | number | boolean | undefined>): string {
  const sp = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== '') sp.set(k, String(v))
  const s = sp.toString()
  return s ? `?${s}` : ''
}
const all = { page_size: 200 }

export const recurringApi = {
  list: () => api<Page<RecurringRule>>(`/recurring/${qs({ ...all, is_active: true })}`).then((p) => p.results),
  create: (body: RecurringInput) => api<RecurringRule>('/recurring/', { method: 'POST', body }),
  update: (id: number, body: Partial<RecurringInput>) => api<RecurringRule>(`/recurring/${id}/`, { method: 'PATCH', body }),
  end: (id: number) => api<void>(`/recurring/${id}/`, { method: 'DELETE' }),
}

export const commitmentsApi = {
  /** Pendentes (inclui atrasados) até a data limite, do mais antigo para o mais novo. */
  pending: (until: string) =>
    api<Page<Transaction>>(`/transactions/${qs({ status: 'pending', date_to: until, ordering: 'date', page_size: 100 })}`).then((p) => p.results),
}

export const cardsApi = {
  list: () => api<Page<CreditCard>>(`/credit-cards/${qs({ ...all, is_archived: false })}`).then((p) => p.results),
  create: (body: CardInput) => api<CreditCard>('/credit-cards/', { method: 'POST', body }),
  update: (id: number, body: Partial<CardInput & { is_archived: boolean }>) => api<CreditCard>(`/credit-cards/${id}/`, { method: 'PATCH', body }),
  purchase: (id: number, body: PurchaseInput) => api<Transaction[]>(`/credit-cards/${id}/purchases/`, { method: 'POST', body }),
  invoices: (card: number) => api<Page<Invoice>>(`/credit-cards/invoices/${qs({ card, ...all })}`).then((p) => p.results),
  invoice: (id: number) => api<InvoiceDetail>(`/credit-cards/invoices/${id}/`),
  pay: (id: number, body: { account: number; date?: string }) => api<InvoiceDetail>(`/credit-cards/invoices/${id}/pay/`, { method: 'POST', body }),
}

export const plansApi = {
  list: (status?: string) => api<Page<InstallmentPlan>>(`/installments/plans/${qs({ ...all, status })}`).then((p) => p.results),
  get: (id: number) => api<InstallmentPlan>(`/installments/plans/${id}/`),
  summary: () => api<PlansSummary>('/installments/plans/summary/'),
  preview: (body: { total_amount: string; count: number; first_date: string }) =>
    api<PlanPreview>('/installments/plans/preview/', { method: 'POST', body }),
  create: (body: PlanInput) => api<InstallmentPlan>('/installments/plans/', { method: 'POST', body }),
  payoff: (id: number, date?: string) => api<InstallmentPlan>(`/installments/plans/${id}/payoff/`, { method: 'POST', body: date ? { date } : {} }),
  cancel: (id: number) => api<InstallmentPlan>(`/installments/plans/${id}/cancel/`, { method: 'POST' }),
}

export const goalsApi = {
  list: () => api<Page<Goal>>(`/goals/${qs({ ...all, is_archived: false })}`).then((p) => p.results),
  create: (body: GoalInput) => api<Goal>('/goals/', { method: 'POST', body }),
  update: (id: number, body: Partial<GoalInput & { is_archived: boolean }>) => api<Goal>(`/goals/${id}/`, { method: 'PATCH', body }),
  contributions: (id: number) => api<Contribution[]>(`/goals/${id}/contributions/`),
  contribute: (id: number, body: ContributionInput) => api<Contribution>(`/goals/${id}/contributions/`, { method: 'POST', body }),
  voidContribution: (id: number, cid: number) => api<Contribution>(`/goals/${id}/contributions/${cid}/void/`, { method: 'POST' }),
}

export const dashboardApi = {
  summary: (month: string) => api<DashboardSummary>(`/dashboard/summary/${qs({ month })}`),
  projection: (months: number) => api<{ months: number; projection: ProjectionMonth[] }>(`/dashboard/projection/${qs({ months })}`),
  simulate: (body: { amount: string; installments: number; first_date: string; months: number }) =>
    api<Simulation>('/dashboard/simulate/', { method: 'POST', body }),
  onboarding: () => api<Onboarding>('/dashboard/onboarding/'),
}

export const reportsApi = {
  summary: (from: string, to: string) => api<Report>(`/reports/summary/${qs({ date_from: from, date_to: to })}`),
  csvUrl: (from: string, to: string) => `/api/v1/reports/export/csv/${qs({ date_from: from, date_to: to })}`,
  pdfUrl: (from: string, to: string) => `/api/v1/reports/export/pdf/${qs({ date_from: from, date_to: to })}`,
}

export const settingsApi = {
  updateProfile: (body: { first_name: string; email: string }) => api<User>('/auth/me/', { method: 'PATCH', body }),
  changePassword: (body: { current_password: string; new_password: string }) => api<void>('/auth/password/', { method: 'POST', body }),
  exportUrl: '/api/v1/auth/export/',
  /** Exclui o usuário e todos os dados dele (definitivo). */
  deleteAccount: (password: string) => api<void>('/auth/delete-account/', { method: 'POST', body: { password } }),
}

export interface PluggyStatus {
  is_connected: boolean
  is_active: boolean
  client_id_masked: string
  item_ids_masked: string
  item_count: number
  last_sync_at: string | null
  last_sync_status: 'idle' | 'running' | 'success' | 'error'
  last_sync_message: string
  last_synced_count: number
  updated_at: string | null
}

export const pluggyApi = {
  getStatus: () => api<PluggyStatus>('/integrations/pluggy/'),
  saveCredentials: (body: { client_id: string; client_secret: string; item_ids: string; sync_now?: boolean }) =>
    api<PluggyStatus>('/integrations/pluggy/', { method: 'PUT', body }),
  syncNow: () => api<PluggyStatus & { sync_result?: { created_transactions: number } }>('/integrations/pluggy/sync/', { method: 'POST' }),
  disconnect: () => api<PluggyStatus>('/integrations/pluggy/', { method: 'DELETE' }),
}
