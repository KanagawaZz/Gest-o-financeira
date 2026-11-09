import { useQuery } from '@tanstack/react-query'
import { AlertTriangle, CalendarClock, Layers, Repeat } from 'lucide-react'
import { Link } from 'react-router-dom'
import { CategoryDonut } from '@/components/charts/CategoryDonut'
import { ChartCard } from '@/components/charts/ChartCard'
import { MonthlyBars } from '@/components/charts/MonthlyBars'
import { Badge } from '@/components/ui/Badge'
import { Card } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { ErrorBlock, LoadingBlock } from '@/components/ui/QueryState'
import { CHART, monthLong, monthShort } from '@/lib/chart'
import { cn } from '@/lib/cn'
import { formatBRL, formatDate } from '@/lib/format'
import { dashboardApi } from '@/services/planning'
import type { UpcomingItem } from '@/types/planning'

function Kpi({ label, value, hint, tone, note }: { label: string; value: string; hint: string; tone?: 'positive' | 'danger'; note?: string }) {
  return (
    <Card className="flex flex-col gap-1 p-4">
      <p className="text-sm text-cinza-t">{label}</p>
      <p className={cn('text-2xl font-semibold tabular-nums', tone === 'positive' && 'text-salvia-t', tone === 'danger' && 'text-queimado-t')}>{value}</p>
      {note && <p className="text-xs font-medium text-queimado-t">{note}</p>}
      <p className="text-xs text-cinza-t">{hint}</p>
    </Card>
  )
}

const STATUS: Record<UpcomingItem['status'], { tone: 'danger' | 'warning' | 'neutral'; label: (d: number) => string }> = {
  overdue: { tone: 'danger', label: (d) => `Atrasada há ${Math.abs(d)} ${Math.abs(d) === 1 ? 'dia' : 'dias'}` },
  due_soon: { tone: 'warning', label: (d) => (d === 0 ? 'Vence hoje' : `Vence em ${d} ${d === 1 ? 'dia' : 'dias'}`) },
  pending: { tone: 'neutral', label: (d) => `Em ${d} dias` },
}

export function OverviewTab({ month }: { month: string }) {
  const q = useQuery({ queryKey: ['dashboard', 'summary', month], queryFn: () => dashboardApi.summary(month) })

  if (q.isPending) return <LoadingBlock label="Calculando seus indicadores…" />
  if (q.isError) return <ErrorBlock message="Não foi possível carregar o resumo financeiro." onRetry={() => void q.refetch()} />
  const s = q.data
  const i = s.indicators
  const e = s.explanations
  const projectedNegative = i.projected_balance !== null && Number(i.projected_balance) < 0
  const currentNegative = Number(i.current_balance) < 0
  const totalExpense = Number(i.expense_paid) + Number(i.expense_pending)
  const noData = s.series.every((x) => Number(x.income) === 0 && Number(x.expense) === 0) && s.upcoming.length === 0

  return (
    <div className="flex flex-col gap-6">
      {s.alerts.length > 0 && (
        <ul aria-label="Alertas" className="flex flex-col gap-2">
          {s.alerts.map((a) => (
            <li
              key={a.code}
              className={cn('flex items-start gap-2 rounded-lg px-3 py-2.5 text-sm', a.level === 'danger' ? 'bg-queimado/15 text-queimado-t' : 'bg-ambar/15 text-ambar-t')}
            >
              <AlertTriangle aria-hidden className="mt-0.5 size-4 shrink-0" />
              <span>
                <span className="font-medium">{a.level === 'danger' ? 'Atenção: ' : 'Aviso: '}</span>
                {a.message}
              </span>
            </li>
          ))}
        </ul>
      )}

      <section aria-label="Indicadores" className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <Kpi label="Receitas recebidas" value={formatBRL(i.income_received)} hint={e.income_received ?? ''} tone="positive" />
        <Kpi label="Receitas previstas" value={formatBRL(i.income_expected)} hint={e.income_expected ?? ''} />
        <Kpi label="Despesas pagas" value={formatBRL(i.expense_paid)} hint={e.expense_paid ?? ''} />
        <Kpi label="Despesas pendentes" value={formatBRL(i.expense_pending)} hint={e.expense_pending ?? ''} />
        <Kpi label="Saldo atual" value={formatBRL(i.current_balance)} hint={e.current_balance ?? ''} tone={currentNegative ? 'danger' : undefined} note={currentNegative ? 'Saldo negativo' : undefined} />
        <Kpi
          label="Saldo projetado (fim do mês)"
          value={i.projected_balance === null ? '—' : formatBRL(i.projected_balance)}
          hint={i.projected_balance === null ? 'A projeção só existe para o mês atual e os próximos.' : (e.projected_balance ?? '')}
          tone={projectedNegative ? 'danger' : undefined}
          note={projectedNegative ? 'Projeção negativa' : undefined}
        />
      </section>

      {i.committed_percent !== null && (
        <Card className="p-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="text-sm text-cinza-t">Renda comprometida no mês</p>
            <p className="text-lg font-semibold tabular-nums">{i.committed_percent.toLocaleString('pt-BR')}%</p>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/10" role="progressbar" aria-valuenow={Math.min(100, i.committed_percent)} aria-valuemin={0} aria-valuemax={100} aria-label="Renda comprometida">
            <div className="h-full rounded-full" style={{ width: `${Math.min(100, i.committed_percent)}%`, background: i.committed_percent > 100 ? CHART.expense : CHART.income }} />
          </div>
          <p className="mt-2 text-xs text-cinza-t">{e.committed_percent}</p>
        </Card>
      )}

      {noData ? (
        <EmptyState
          icon={CalendarClock}
          title="Ainda não há movimentações para mostrar"
          description="Cadastre uma conta e registre receitas e despesas. Os gráficos e a projeção aparecem aqui."
          action={
            <Link to="/contas" className="inline-flex min-h-10 items-center rounded-lg bg-suave px-4 text-sm font-medium text-marinho hover:bg-suave-forte">
              Começar pelas contas
            </Link>
          }
        />
      ) : (
        <>
          <div className="grid items-start gap-6 xl:grid-cols-[3fr_2fr]">
            <ChartCard
              title="Receitas × despesas"
              subtitle="Últimos 6 meses, por data do lançamento (inclui pendentes)."
              legend={[
                { label: 'Receitas', color: CHART.income },
                { label: 'Despesas', color: CHART.expense },
              ]}
              summary={`Receitas e despesas dos últimos 6 meses. ${s.series.map((x) => `${monthShort(x.month)}: receitas ${formatBRL(x.income)}, despesas ${formatBRL(x.expense)}`).join('; ')}.`}
              table={{
                columns: ['Mês', 'Receitas', 'Despesas'],
                rows: s.series.map((x) => [monthLong(x.month), formatBRL(x.income), formatBRL(x.expense)]),
              }}
            >
              <MonthlyBars data={s.series.map((x) => ({ month: x.month, income: Number(x.income), expense: Number(x.expense) }))} />
            </ChartCard>

            <Card>
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-base font-medium">Próximos vencimentos</h2>
                <Link to="/contas" className="text-xs text-suave-t hover:underline">
                  Ver todos
                </Link>
              </div>
              {s.upcoming.length === 0 ? (
                <p className="py-6 text-center text-sm text-cinza-t">Nada a vencer nos próximos 30 dias.</p>
              ) : (
                <ul className="divide-y divide-white/8">
                  {s.upcoming.map((u) => {
                    const st = STATUS[u.status]
                    return (
                      <li key={`${u.source}-${u.id}-${u.due_date}`} className="flex items-center gap-3 py-2.5">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">{u.description}</p>
                          <p className="text-xs text-cinza-t">{formatDate(u.due_date)}</p>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          <p className={cn('text-sm font-semibold tabular-nums', u.kind === 'income' && 'text-salvia-t')}>
                            {u.kind === 'income' ? '+ ' : ''}
                            {formatBRL(u.amount)}
                          </p>
                          <Badge tone={st.tone}>{u.kind === 'income' ? 'A receber' : st.label(u.days_left)}</Badge>
                        </div>
                      </li>
                    )
                  })}
                </ul>
              )}
            </Card>
          </div>

          <div className="grid items-start gap-6 xl:grid-cols-[3fr_2fr]">
            <ChartCard
              title="Despesas por categoria"
              subtitle={`${monthLong(month)} · consumo, sem contar o pagamento da fatura duas vezes.`}
              summary={`Despesas por categoria: ${s.by_category.map((c) => `${c.name} ${c.percent}%`).join(', ')}.`}
              table={{ columns: ['Categoria', 'Valor', '%'], rows: s.by_category.map((c) => [c.name, formatBRL(c.amount), `${c.percent}%`]) }}
            >
              {s.by_category.length ? <CategoryDonut items={s.by_category} total={String(totalExpense.toFixed(2))} /> : <p className="py-10 text-center text-sm text-cinza-t">Sem despesas neste mês.</p>}
            </ChartCard>

            <Card>
              <h2 className="mb-4 text-base font-medium">Compromissos do mês</h2>
              <ul className="space-y-4">
                <li className="flex items-center gap-3">
                  <Repeat aria-hidden className="size-5 text-suave-t" />
                  <div className="flex-1">
                    <p className="text-sm font-medium">Contas recorrentes</p>
                    <p className="text-xs text-cinza-t">{s.recurring_and_installments.recurring_count} pendente(s)</p>
                  </div>
                  <p className="text-sm font-semibold tabular-nums">{formatBRL(s.recurring_and_installments.recurring_total)}</p>
                </li>
                <li className="flex items-center gap-3">
                  <Layers aria-hidden className="size-5 text-suave-t" />
                  <div className="flex-1">
                    <p className="text-sm font-medium">Parcelas</p>
                    <p className="text-xs text-cinza-t">{s.recurring_and_installments.installments_count} pendente(s)</p>
                  </div>
                  <p className="text-sm font-semibold tabular-nums">{formatBRL(s.recurring_and_installments.installments_total)}</p>
                </li>
              </ul>
              <Link to="/parcelamentos" className="mt-5 inline-block text-xs text-suave-t hover:underline">
                Ver parcelamentos
              </Link>
            </Card>
          </div>
        </>
      )}
    </div>
  )
}
