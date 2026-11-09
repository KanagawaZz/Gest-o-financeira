import type {
  AccountInput,
  Category,
  CategoryInput,
  FinancialAccount,
  Page,
  Transaction,
  TransactionFilters,
  TransactionInput,
  TransactionSummary,
} from '@/types/finance'
import { api } from './api'

function qs(params: Record<string, string | number | boolean | undefined>): string {
  const sp = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== '') sp.set(k, String(v))
  const s = sp.toString()
  return s ? `?${s}` : ''
}

export const categoriesApi = {
  list: () => api<Page<Category>>(`/categories/${qs({ page_size: 200 })}`).then((p) => p.results),
  create: (body: CategoryInput) => api<Category>('/categories/', { method: 'POST', body }),
  update: (id: number, body: Partial<CategoryInput & { is_archived: boolean }>) =>
    api<Category>(`/categories/${id}/`, { method: 'PATCH', body }),
}

export const accountsApi = {
  list: () => api<Page<FinancialAccount>>(`/accounts/${qs({ page_size: 200 })}`).then((p) => p.results),
  create: (body: AccountInput) => api<FinancialAccount>('/accounts/', { method: 'POST', body }),
  update: (id: number, body: Partial<AccountInput & { is_archived: boolean }>) =>
    api<FinancialAccount>(`/accounts/${id}/`, { method: 'PATCH', body }),
}

export const transactionsApi = {
  list: (filters: TransactionFilters, page: number, pageSize = 25) =>
    api<Page<Transaction>>(`/transactions/${qs({ ...filters, page, page_size: pageSize })}`),
  summary: (filters: TransactionFilters) => api<TransactionSummary>(`/transactions/summary/${qs({ ...filters })}`),
  create: (body: TransactionInput) => api<Transaction>('/transactions/', { method: 'POST', body }),
  update: (id: number, body: Partial<TransactionInput>) =>
    api<Transaction>(`/transactions/${id}/`, { method: 'PATCH', body }),
  void: (id: number) => api<Transaction>(`/transactions/${id}/void/`, { method: 'POST' }),
  remove: (id: number) => api<void>(`/transactions/${id}/`, { method: 'DELETE' }),
}
