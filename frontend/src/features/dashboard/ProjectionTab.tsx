import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { BalanceLines } from '@/components/charts/BalanceLines'
import { ChartCard } from '@/components/charts/ChartCard'
import { Badge } from '@/components/ui/Badge'
import { Card } from '@/components/ui/Card'
import { ErrorBlock, LoadingBlock } from '@/components/ui/QueryState'
import { Tabs } from '@/components/ui/Tabs'
import { CHART, monthLong, monthShort } from '@/lib/chart'
import { cn } from '@/lib/cn'
import { formatBRL, formatDate } from '@/lib/format'
import { dashboardApi } from '@/services/planning'

const HORIZONS = [
  { value: '3', label: '3 meses' },
  { value: '6', label: '6 meses' },
  { value: '12', label: '12 meses' },
  { value: '24', label: '24 meses' },
]

export function ProjectionTab() {
  const [months, setMonths] = useState('6')
  const q = useQuery({ queryKey: ['dashboard', 'projection', months], queryFn: () => dashboardApi.projection(Number(months)) })

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Tabs items={HORIZONS} value={months} onChange={setMonths} label="Horizonte da projeção" />
      </div>

      <Card className="text-sm text-cinza-t">
        <p>
          <strong className="font-medium text-branco">Saldo projetado = saldo inicial + entradas previstas − saídas previstas.</strong> Considera lançamentos pendentes,
          parcelas, contas recorrentes e faturas de cartão (no vencimento). O que está atrasado entra no primeiro mês.
          O <strong className="font-medium text-branco">saldo conservador</strong> não conta receitas estimadas (valores variáveis, não garantidos).
        </p>
      </Card>

      {q.isPending ? (
        <LoadingBlock label="Calculando a projeção…" />
      ) : q.isError ? (
        <ErrorBlock message="Não foi possível calcular a projeção." onRetry={() => void q.refetch()} />
      ) : (
        <>
          <ChartCard
            title="Saldo projetado ao fim de cada mês"
            legend={[
              { label: 'Saldo projetado', color: CHART.income },
              { label: 'Saldo conservador (sem receitas estimadas)', color: CHART.expense, dashed: true },
            ]}
            summary={`Saldo projetado por mês: ${q.data.projection.map((p) => `${monthShort(p.month)} ${formatBRL(p.closing_balance)}`).join('; ')}.`}
            table={{
              columns: ['Mês', 'Projetado', 'Conservador'],
              rows: q.data.projection.map((p) => [monthLong(p.month), formatBRL(p.closing_balance), formatBRL(p.closing_balance_conservative)]),
            }}
          >
            <BalanceLines
              data={q.data.projection.map((p) => ({ month: p.month, projected: Number(p.closing_balance), conservative: Number(p.closing_balance_conservative) }))}
              series={[
                { key: 'projected', label: 'Saldo projetado', color: CHART.income },
                { key: 'conservative', label: 'Saldo conservador', color: CHART.expense, dashed: true },
              ]}
            />
          </ChartCard>

          <section aria-label="Detalhe por mês" className="flex flex-col gap-3">
            <h2 className="text-base font-medium">O que compõe cada mês</h2>
            {q.data.projection.map((p) => {
              const negative = Number(p.closing_balance) < 0
              return (
                <details key={p.month} className="rounded-xl border border-white/8 bg-aco">
                  <summary className="flex cursor-pointer flex-wrap items-center gap-x-6 gap-y-1 px-4 py-3">
                    <span className="min-w-32 font-medium first-letter:uppercase">{monthLong(p.month)}</span>
                    <span className="text-xs text-cinza-t">
                      Entradas {formatBRL(Number(p.income_confirmed) + Number(p.income_estimated))} · Saídas {formatBRL(Number(p.expense_confirmed) + Number(p.expense_estimated))}
                    </span>
                    <span className={cn('ml-auto text-sm font-semibold tabular-nums', negative && 'text-queimado-t')}>
                      {formatBRL(p.closing_balance)}
                      {negative && <span className="ml-2 text-xs font-medium">negativo</span>}
                    </span>
                  </summary>
                  <div className="border-t border-white/8 px-4 py-3">
                    <dl className="mb-3 grid grid-cols-2 gap-x-6 gap-y-1 text-xs text-cinza-t sm:grid-cols-3">
                      <div><dt>Saldo inicial</dt><dd className="text-sm text-branco tabular-nums">{formatBRL(p.opening_balance)}</dd></div>
                      <div><dt>Entradas confirmadas</dt><dd className="text-sm text-branco tabular-nums">{formatBRL(p.income_confirmed)}</dd></div>
                      <div><dt>Entradas estimadas</dt><dd className="text-sm text-branco tabular-nums">{formatBRL(p.income_estimated)}</dd></div>
                      <div><dt>Saídas confirmadas</dt><dd className="text-sm text-branco tabular-nums">{formatBRL(p.expense_confirmed)}</dd></div>
                      <div><dt>Saídas estimadas</dt><dd className="text-sm text-branco tabular-nums">{formatBRL(p.expense_estimated)}</dd></div>
                      <div><dt>Saldo conservador</dt><dd className="text-sm text-branco tabular-nums">{formatBRL(p.closing_balance_conservative)}</dd></div>
                    </dl>
                    {p.items.length === 0 ? (
                      <p className="text-sm text-cinza-t">Nenhum lançamento previsto neste mês.</p>
                    ) : (
                      <ul className="divide-y divide-white/8 text-sm">
                        {p.items.map((it, idx) => (
                          <li key={idx} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2">
                            <span className="w-20 text-xs text-cinza-t">{formatDate(it.date)}</span>
                            <span className="min-w-0 flex-1 truncate">{it.description}</span>
                            {it.overdue && <Badge tone="danger">Atrasada</Badge>}
                            {it.estimate && <Badge tone="warning">Estimada</Badge>}
                            {it.source === 'invoice' && <Badge>Fatura</Badge>}
                            <span className={cn('w-28 text-right tabular-nums', it.kind === 'income' && 'text-salvia-t')}>
                              {it.kind === 'income' ? '+ ' : '− '}
                              {formatBRL(it.amount)}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </details>
              )
            })}
          </section>
        </>
      )}
    </div>
  )
}
