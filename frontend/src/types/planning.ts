import type { TxType } from './finance'

// ---------- Recorrência ----------
export type Frequency = 'weekly' | 'monthly' | 'yearly' | 'custom'
export type RecurringRule = {
  id: number
  description: string
  type: 'income' | 'expense'
  amount: string
  category: number
  category_name: string
  account: number
  account_name: string
  frequency: Frequency
  interval_days: number | null
  start_date: string
  end_date: string | null
  variable: boolean
  is_active: boolean
  notes: string
  next_due: string | null
}
export type RecurringInput = {
  description: string
  type: 'income' | 'expense'
  amount: string
  category: number
  account: number
  frequency: Frequency
  interval_days: number | null
  start_date: string
  end_date: string | null
  variable: boolean
  notes: string
  apply_to_future?: boolean
}
export const FREQUENCY_LABEL: Record<Frequency, string> = {
  weekly: 'Semanal',
  monthly: 'Mensal',
  yearly: 'Anual',
  custom: 'Personalizada',
}

// ---------- Cartões ----------
export type CurrentInvoice = {
  id: number | null
  year: number
  month: number
  closing_date: string
  due_date: string
  status: 'open' | 'paid'
  total: string
}
export type CreditCard = {
  id: number
  name: string
  institution: string
  credit_limit: string
  closing_day: number
  due_day: number
  color: string
  is_archived: boolean
  limit_used: string
  limit_available: string
  current_invoice: CurrentInvoice
}
export type CardInput = { name: string; institution: string; credit_limit: string; closing_day: number; due_day: number; color: string }
export type Invoice = {
  id: number
  card: number
  card_name: string
  year: number
  month: number
  closing_date: string
  due_date: string
  status: 'open' | 'paid'
  paid_at: string | null
  total: string
  payment_transaction: number | null
}
export type InvoiceEntry = {
  id: number
  description: string
  amount: string
  date: string
  installment_number: number | null
  category_name: string | null
  status: string
}
export type InvoiceDetail = Invoice & { purchases: InvoiceEntry[] }
export type PurchaseInput = { description: string; amount: string; category: number; date: string; installments: number; notes: string }

// ---------- Parcelamentos ----------
export type PlanStatus = 'active' | 'finished' | 'cancelled'
export type PlanRow = { id: number; installment_number: number; amount: string; date: string; status: string; settled_date: string | null }
export type InstallmentPlan = {
  id: number
  description: string
  total_amount: string
  count: number
  first_date: string
  category: number
  category_name: string
  account: number | null
  account_name: string | null
  credit_card: number | null
  credit_card_name: string | null
  status: PlanStatus
  paid_count: number
  pending_count: number
  remaining_amount: string
  progress_percent: number
  early_payoff_at: string | null
  installments?: PlanRow[]
}
export type PlanInput = {
  description: string
  total_amount: string
  count: number
  first_date: string
  category: number
  account: number | null
  credit_card: number | null
  notes: string
}
export type PlansSummary = {
  committed_total: string
  active_plans: number
  this_month: string
  next_months: { month: string; amount: string }[]
  progress_percent: number
}
export type PlanPreview = { installments: { number: number; amount: string; date: string }[]; total: string }

// ---------- Metas ----------
export type Goal = {
  id: number
  name: string
  target_amount: string
  target_date: string | null
  priority: 'low' | 'medium' | 'high'
  description: string
  is_archived: boolean
  progress: {
    current_amount: string
    remaining_amount: string
    progress_percent: number
    months_left: number | null
    monthly_needed: string | null
  }
}
export type GoalInput = { name: string; target_amount: string; target_date: string | null; priority: Goal['priority']; description: string }
export type Contribution = {
  id: number
  transaction: number
  amount: string
  date: string
  status: string
  account_name: string
  destination_account_name: string
}
export type ContributionInput = { amount: string; date: string; account: number; destination_account: number; notes: string }
export const PRIORITY_LABEL: Record<Goal['priority'], string> = { low: 'Baixa', medium: 'Média', high: 'Alta' }

// ---------- Dashboard / projeção ----------
export type UpcomingItem = {
  id: number | null
  source: 'transaction' | 'invoice'
  kind: TxType
  description: string
  amount: string
  due_date: string
  days_left: number
  status: 'overdue' | 'due_soon' | 'pending'
}
export type DashboardAlert = { level: 'danger' | 'warning'; code: string; message: string }
export type TrendKey = 'income_received' | 'income_expected' | 'expense_paid' | 'expense_pending' | 'current_balance' | 'projected_balance'
export type TrendPoint = { month: string; value: string }
export type DashboardSummary = {
  month: string
  indicators: {
    income_received: string
    income_expected: string
    expense_paid: string
    expense_pending: string
    current_balance: string
    projected_balance: string | null
    month_result: string
    committed_percent: number | null
  }
  explanations: Record<string, string>
  by_category: { category_id: number | null; name: string; color: string; amount: string; percent: number }[]
  series: { month: string; income: string; expense: string }[]
  /** 6 meses por indicador. Consumo: até o mês escolhido. Saldo atual: até hoje. Projetado: deste mês em diante. */
  trends: Record<TrendKey, TrendPoint[]>
  upcoming: UpcomingItem[]
  recurring_and_installments: { recurring_total: string; recurring_count: number; installments_total: string; installments_count: number }
  alerts: DashboardAlert[]
}
export type ProjectionItem = { date: string; description: string; kind: string; amount: string; source: string; estimate: boolean; overdue: boolean }
export type ProjectionMonth = {
  month: string
  opening_balance: string
  income_confirmed: string
  income_estimated: string
  expense_confirmed: string
  expense_estimated: string
  closing_balance: string
  closing_balance_conservative: string
  items: ProjectionItem[]
}
export type Simulation = {
  monthly_installment: string
  installments: number
  months_affected: string[]
  becomes_negative_in: string[]
  baseline: ProjectionMonth[]
  with_purchase: ProjectionMonth[]
  impact: { month: string; installment: string; balance_before: string; balance_after: string; accumulated_impact: string; affected: boolean }[]
  persisted: false
}

// ---------- Relatórios ----------
export type Report = {
  period: { from: string; to: string }
  totals: { income: string; expense: string; result: string; committed_percent: number | null }
  expense_by_category: { name: string; color: string; amount: string; percent: number }[]
  income_by_category: { name: string; color: string; amount: string; percent: number }[]
  by_card: { card: string; amount: string; purchases: number }[]
  monthly: { month: string; income: string; expense: string; result: string; expense_variation_percent: number | null }[]
  future_commitments: { month: string; expense: string; income: string; closing_balance: string }[]
  active_installments: { id: number; description: string; remaining_amount: string; remaining_count: number; count: number }[]
  largest_expenses: { description: string; amount: string; date: string }[]
}
