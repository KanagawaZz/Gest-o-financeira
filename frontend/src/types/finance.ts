export type Page<T> = { count: number; next: string | null; previous: string | null; results: T[] }

export type CategoryKind = 'expense' | 'income'
export type Category = {
  id: number
  name: string
  kind: CategoryKind
  color: string
  icon: string
  is_archived: boolean
}
export type CategoryInput = Pick<Category, 'name' | 'kind' | 'color'>

export type AccountType = 'checking' | 'wallet' | 'savings' | 'investment'
export type FinancialAccount = {
  id: number
  name: string
  type: AccountType
  initial_balance: string
  current_balance: string
  color: string
  is_archived: boolean
}
export type AccountInput = { name: string; type: AccountType; initial_balance: string; color: string }

export type TxType = 'income' | 'expense' | 'transfer' | 'card_payment'
export type TxStatus = 'pending' | 'realized' | 'voided' | 'cancelled'
export type Transaction = {
  id: number
  type: TxType
  description: string
  amount: string
  category: number | null
  category_name: string | null
  category_color: string | null
  account: number | null
  account_name: string | null
  destination_account: number | null
  destination_account_name: string | null
  credit_card: number | null
  credit_card_name: string | null
  invoice: number | null
  recurring_rule: number | null
  installment_plan: number | null
  installment_number: number | null
  is_estimate: boolean
  date: string
  competence_date: string | null
  settled_date: string | null
  status: TxStatus
  notes: string
}
export type TransactionInput = {
  type: TxType
  description: string
  amount: string
  category: number | null
  account: number
  destination_account: number | null
  date: string
  competence_date: string | null
  settled_date: string | null
  status: 'pending' | 'realized'
  notes: string
}
export type TransactionFilters = {
  type?: TxType
  status?: TxStatus
  account?: number
  search?: string
  date_from?: string
  date_to?: string
}
export type TransactionSummary = {
  income_realized: string
  income_pending: string
  expense_realized: string
  expense_pending: string
}

export const ACCOUNT_TYPE_LABEL: Record<AccountType, string> = {
  checking: 'Conta corrente',
  wallet: 'Carteira',
  savings: 'Poupança/Reserva',
  investment: 'Investimentos',
}
