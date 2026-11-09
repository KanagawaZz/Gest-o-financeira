import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactElement } from 'react'
import { MemoryRouter } from 'react-router-dom'
import { ToastProvider } from '@/components/ui/Toast'
import { AccountsHubPage } from '@/features/accounts/AccountsHubPage'
import { AuthProvider } from '@/features/auth/AuthProvider'
import { CardsPage } from '@/features/cards/CardsPage'
import { DashboardPage } from '@/features/dashboard/DashboardPage'
import { GoalsPage } from '@/features/goals/GoalsPage'
import { InstallmentsPage } from '@/features/installments/InstallmentsPage'
import { ReportsPage } from '@/features/reports/ReportsPage'
import { SettingsPage } from '@/features/settings/SettingsPage'

const page = (results: unknown[]) => ({ count: results.length, next: null, previous: null, results })
const user = { id: 1, username: 'ana', first_name: 'Ana', email: 'ana@x.com' }
const account = { id: 1, name: 'Nubank', type: 'checking', initial_balance: '1000.00', current_balance: '3600.00', color: '#5A96D2', is_archived: false }
const reserve = { ...account, id: 2, name: 'Reserva', current_balance: '0.00' }
const category = { id: 10, name: 'Alimentação', kind: 'expense', color: '#5A96D2', icon: 'tag', is_archived: false }
const card = {
  id: 5, name: 'Visa', institution: 'Banco', credit_limit: '5000.00', closing_day: 10, due_day: 20, color: '#CF7752', is_archived: false,
  limit_used: '4600.00', limit_available: '400.00',
  current_invoice: { id: 9, year: 2026, month: 11, closing_date: '2026-11-10', due_date: '2026-11-20', status: 'open', total: '600.00' },
}
const summary = {
  month: '2026-11',
  indicators: { income_received: '3000.00', income_expected: '500.00', expense_paid: '400.00', expense_pending: '850.00', current_balance: '3600.00', projected_balance: '-120.00', month_result: '2600.00', committed_percent: 35.7 },
  explanations: { income_received: 'Receitas já recebidas.', income_expected: 'Receitas pendentes.', expense_paid: 'Despesas pagas.', expense_pending: 'Despesas pendentes.', current_balance: 'Saldo hoje.', projected_balance: 'Saldo no fim do mês.', committed_percent: 'Despesas ÷ receitas.' },
  by_category: [{ category_id: 10, name: 'Alimentação', color: '#5A96D2', amount: '650.00', percent: 100 }],
  series: [{ month: '2026-10', income: '2000.00', expense: '1500.00' }, { month: '2026-11', income: '3500.00', expense: '1250.00' }],
  upcoming: [{ id: 1, source: 'transaction', kind: 'expense', description: 'Internet', amount: '100.00', due_date: '2026-11-12', days_left: 3, status: 'due_soon' }],
  recurring_and_installments: { recurring_total: '100.00', recurring_count: 1, installments_total: '360.00', installments_count: 1 },
  alerts: [{ level: 'danger', code: 'negative_projection', message: 'O saldo projetado fica negativo em 2026-12.' }],
}
const proj = (m: string, closing: string) => ({ month: m, opening_balance: '3600.00', income_confirmed: '0.00', income_estimated: '2000.00', expense_confirmed: '500.00', expense_estimated: '0.00', closing_balance: closing, closing_balance_conservative: '1100.00',
  items: [{ date: '2026-11-12', description: 'Internet', kind: 'expense', amount: '100.00', source: 'transaction', estimate: false, overdue: true }, { date: '2026-11-20', description: 'Freelance', kind: 'income', amount: '2000.00', source: 'transaction', estimate: true, overdue: false }] })
const plan = { id: 3, description: 'Celular', total_amount: '4320.00', count: 12, first_date: '2026-06-01', category: 10, category_name: 'Compras', account: 1, account_name: 'Nubank', credit_card: null, credit_card_name: null, status: 'active', paid_count: 6, pending_count: 6, remaining_amount: '2160.00', progress_percent: 50, early_payoff_at: null }
const goal = { id: 7, name: 'Viagem', target_amount: '4000.00', target_date: '2027-07-01', priority: 'medium', description: '', is_archived: false, progress: { current_amount: '500.00', remaining_amount: '3500.00', progress_percent: 12, months_left: 8, monthly_needed: '437.50' } }
const report = {
  period: { from: '2026-11-01', to: '2026-11-30' }, totals: { income: '3000.00', expense: '1500.00', result: '1500.00', committed_percent: 50 },
  expense_by_category: [{ name: 'Alimentação', color: '#5A96D2', amount: '1100.00', percent: 73.3 }, { name: 'Lazer', color: '#CF7752', amount: '400.00', percent: 26.7 }], income_by_category: [],
  by_card: [{ card: 'Visa', amount: '500.00', purchases: 1 }], monthly: [{ month: '2026-11', income: '3000.00', expense: '1500.00', result: '1500.00', expense_variation_percent: null }],
  future_commitments: [{ month: '2026-11', expense: '600.00', income: '0.00', closing_balance: '3000.00' }], active_installments: [{ id: 3, description: 'Celular', remaining_amount: '2160.00', remaining_count: 6, count: 12 }],
  largest_expenses: [{ description: 'TV', amount: '600.00', date: '2026-11-05' }],
}

// Roteador de respostas: primeira regra que casar com a URL.
const ROUTES: [RegExp, unknown][] = [
  [/\/auth\/me\//, user],
  [/\/dashboard\/summary\//, summary],
  [/\/dashboard\/projection\//, { months: 6, projection: [proj('2026-11', '-120.00'), proj('2026-12', '900.00')] }],
  [/\/dashboard\/simulate\//, { monthly_installment: '300.00', installments: 4, months_affected: ['2026-11'], becomes_negative_in: ['2026-12'], baseline: [], with_purchase: [], persisted: false,
    impact: [{ month: '2026-11', installment: '300.00', balance_before: '1000.00', balance_after: '700.00', accumulated_impact: '300.00', affected: true }, { month: '2026-12', installment: '300.00', balance_before: '200.00', balance_after: '-100.00', accumulated_impact: '600.00', affected: true }] }],
  [/\/credit-cards\/invoices\/9\//, { id: 9, card: 5, card_name: 'Visa', year: 2026, month: 11, closing_date: '2026-11-10', due_date: '2026-11-20', status: 'open', paid_at: null, total: '600.00', payment_transaction: null, purchases: [{ id: 1, description: 'TV', amount: '600.00', date: '2026-11-05', installment_number: null, category_name: 'Compras', status: 'pending' }] }],
  [/\/credit-cards\/invoices\//, page([{ id: 9, card: 5, card_name: 'Visa', year: 2026, month: 11, closing_date: '2026-11-10', due_date: '2026-11-20', status: 'open', paid_at: null, total: '600.00', payment_transaction: null }])],
  [/\/credit-cards\//, page([card])],
  [/\/installments\/plans\/summary\//, { committed_total: '2160.00', active_plans: 1, this_month: '360.00', next_months: [{ month: '2026-11', amount: '360.00' }], progress_percent: 50 }],
  [/\/installments\/plans\/3\//, { ...plan, installments: [{ id: 1, installment_number: 1, amount: '360.00', date: '2026-06-01', status: 'realized', settled_date: '2026-06-01' }] }],
  [/\/installments\/plans\//, page([plan])],
  [/\/goals\/7\/contributions\//, [{ id: 1, transaction: 4, amount: '500.00', date: '2026-11-05', status: 'realized', account_name: 'Nubank', destination_account_name: 'Reserva' }]],
  [/\/goals\//, page([goal])],
  [/\/reports\/summary\//, report],
  [/\/recurring\//, page([{ id: 1, description: 'Internet', type: 'expense', amount: '100.00', category: 10, category_name: 'Serviços', account: 1, account_name: 'Nubank', frequency: 'monthly', interval_days: null, start_date: '2026-01-12', end_date: null, variable: true, is_active: true, notes: '', next_due: '2026-11-12' }])],
  [/\/transactions\//, page([{ id: 1, type: 'expense', description: 'Aluguel atrasado', amount: '1200.00', category: 10, category_name: 'Moradia', category_color: null, account: 1, account_name: 'Nubank', destination_account: null, destination_account_name: null,
    credit_card: null, credit_card_name: null, invoice: null, recurring_rule: 1, installment_plan: null, installment_number: null, is_estimate: true, date: '2000-01-05', competence_date: null, settled_date: null, status: 'pending', notes: '' }])],
  [/\/accounts\//, page([account, reserve])],
  [/\/categories\//, page([category])],
]

beforeEach(() => {
  document.cookie = 'csrftoken=abc'
  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    const hit = ROUTES.find(([re]) => re.test(url))
    return hit ? new Response(JSON.stringify(hit[1]), { status: 200 }) : new Response(JSON.stringify({ error: { code: 'nf', message: 'x', details: null } }), { status: 404 })
  }))
})
afterEach(() => vi.unstubAllGlobals())

function mount(ui: ReactElement) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <AuthProvider>
          <ToastProvider>{ui}</ToastProvider>
        </AuthProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}
const money = (v: string) => new RegExp(`R\\$\\s*${v.replace(/\./g, '\\.')}`)

describe('páginas principais (renderização com dados simulados)', () => {
  it('Dashboard: indicadores com explicação, alerta e saldo negativo em texto', async () => {
    mount(<DashboardPage />)
    expect(await screen.findByText('Receitas recebidas')).toBeInTheDocument()
    expect(screen.getAllByText(money('3.000,00')).length).toBeGreaterThan(0)
    expect(screen.getByText('Saldo no fim do mês.')).toBeInTheDocument()
    expect(screen.getByText('Projeção negativa')).toBeInTheDocument() // não depende só da cor
    expect(screen.getByText(/O saldo projetado fica negativo/)).toBeInTheDocument()
    expect(screen.getByText('Vence em 3 dias')).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: /Ver como tabela/ }).length).toBeGreaterThan(0)
  })

  it('Dashboard: gráfico alterna para tabela equivalente', async () => {
    mount(<DashboardPage />)
    const toggles = await screen.findAllByRole('button', { name: /Ver como tabela/ })
    await userEvent.click(toggles[0]!)
    expect(await screen.findByRole('columnheader', { name: 'Receitas' })).toBeInTheDocument()
  })

  it('Dashboard: projeção mostra de onde vem cada mês, com atrasadas e estimadas rotuladas', async () => {
    mount(<DashboardPage />)
    await userEvent.click(await screen.findByRole('tab', { name: 'Projeção' }))
    expect(await screen.findByText(/Saldo projetado = saldo inicial/)).toBeInTheDocument()
    expect((await screen.findAllByText('Atrasada')).length).toBeGreaterThan(0)
    expect(screen.getAllByText('Estimada').length).toBeGreaterThan(0)
    expect(screen.getAllByText('negativo').length).toBeGreaterThan(0)
  })

  it('Simulador: valida entrada, simula e avisa que nada foi registrado', async () => {
    mount(<DashboardPage />)
    await userEvent.click(await screen.findByRole('tab', { name: 'Simulador' }))
    await userEvent.click(screen.getByRole('button', { name: 'Simular' }))
    expect(await screen.findByText(/Informe o valor da compra/)).toBeInTheDocument()
    await userEvent.type(screen.getByLabelText('Valor total (R$)'), '1.200,00')
    await userEvent.click(screen.getByRole('button', { name: 'Simular' }))
    expect(await screen.findByText('Saldo ficaria negativo')).toBeInTheDocument()
    expect(screen.getByText(/Nada é registrado/)).toBeInTheDocument()
  })

  it('Compromissos: atrasado aparece com texto, recorrente e estimado; regra listada', async () => {
    mount(<AccountsHubPage />)
    expect(await screen.findByText('Aluguel atrasado')).toBeInTheDocument()
    expect(screen.getByText(/Atrasada há \d+ dias/)).toBeInTheDocument()
    expect(screen.getByText('Recorrente')).toBeInTheDocument()
    expect(screen.getByText('Valor estimado')).toBeInTheDocument()
    expect(screen.getByText('Próximo: 12/11/2026')).toBeInTheDocument()
  })

  it('Cartões: limite, alerta de limite quase no fim e fatura aberta', async () => {
    mount(<CardsPage />)
    expect(await screen.findByText('Visa')).toBeInTheDocument()
    expect(screen.getByText('Limite quase no fim')).toBeInTheDocument()
    expect(screen.getByText('Em aberto')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /Faturas/ }))
    const dialog = await screen.findByRole('dialog', { name: /Faturas · Visa/ })
    expect(await within(dialog).findByRole('button', { name: 'Pagar fatura' })).toBeInTheDocument()
    expect(within(dialog).getByText('TV')).toBeInTheDocument()
  })

  it('Parcelamentos: resumo, progresso e parcelas expandidas', async () => {
    mount(<InstallmentsPage />)
    expect(await screen.findByText('Celular')).toBeInTheDocument()
    expect(screen.getByText('6/12')).toBeInTheDocument()
    expect(screen.getAllByText(money('2.160,00')).length).toBeGreaterThan(0)
    await userEvent.click(screen.getByRole('button', { name: 'Ver parcelas' }))
    expect(await screen.findByText('Paga')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Quitar/ })).toBeInTheDocument()
  })

  it('Metas: progresso e quanto guardar por mês', async () => {
    mount(<GoalsPage />)
    expect(await screen.findByText('Viagem')).toBeInTheDocument()
    expect(screen.getByText(money('437,50'))).toBeInTheDocument()
    expect(screen.getByRole('progressbar', { name: 'Progresso da meta Viagem' })).toHaveAttribute('aria-valuenow', '12')
    await userEvent.click(screen.getByRole('button', { name: 'Aportes' }))
    expect(await screen.findByText('Nubank → Reserva')).toBeInTheDocument()
  })

  it('Relatórios: totais, exportação e tabelas', async () => {
    mount(<ReportsPage />)
    expect(await screen.findByText('Comparação entre meses')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /CSV/ })).toHaveAttribute('href', expect.stringContaining('/api/v1/reports/export/csv/?date_from='))
    expect(screen.getByRole('link', { name: /PDF/ })).toBeInTheDocument()
    expect(screen.getByText('Gastos por cartão')).toBeInTheDocument()
    expect(screen.getByText('50%')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('tab', { name: 'Personalizado' }))
    expect(screen.getByLabelText('De')).toBeInTheDocument()
  })

  it('Configurações: confere confirmação de senha antes de chamar a API', async () => {
    mount(<SettingsPage />)
    await userEvent.type(await screen.findByLabelText('Senha atual'), 'antiga-senha-1')
    await userEvent.type(screen.getByLabelText('Nova senha'), 'NovaSenha-Segura-9')
    await userEvent.type(screen.getByLabelText('Confirmar nova senha'), 'diferente')
    await userEvent.click(screen.getByRole('button', { name: 'Alterar senha' }))
    expect(await screen.findByText('As senhas não coincidem.')).toBeInTheDocument()
    await waitFor(() => expect(vi.mocked(fetch).mock.calls.some(([u]) => String(u).includes('/auth/password/'))).toBe(false))
    expect(screen.getByRole('link', { name: /Exportar meus dados/ })).toHaveAttribute('href', '/api/v1/auth/export/')
  })
})
