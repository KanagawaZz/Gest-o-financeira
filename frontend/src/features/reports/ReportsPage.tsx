import { useQuery } from '@tanstack/react-query'
import { ChevronLeft, ChevronRight, Download, FileText } from 'lucide-react'
import { useState } from 'react'
import { CategoryDonut } from '@/components/charts/CategoryDonut'
import { ChartCard } from '@/components/charts/ChartCard'
import { MonthlyBars } from '@/components/charts/MonthlyBars'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { inputClass, Field } from '@/components/ui/Field'
import { PageHeader } from '@/components/ui/PageHeader'
import { ErrorBlock, LoadingBlock } from '@/components/ui/QueryState'
import { Tabs } from '@/components/ui/Tabs'
import { CHART, monthLong, monthShort } from '@/lib/chart'
import { cn } from '@/lib/cn'
import { formatBRL, formatDate } from '@/lib/format'
import { todayISO } from '@/lib/money'
import { periodLabel, periodRange, shiftPeriod, type PeriodAnchor, type PeriodKind } from '@/lib/period'
import { reportsApi } from '@/services/planning'

const KINDS: { value: PeriodKind; label: string }[] = [
  { value: 'month', label: 'Mês' },
  { value: 'quarter', label: 'Trimestre' },
  { value: 'semester', label: 'Semestre' },
  { value: 'year', label: 'Ano' },
  { value: 'custom', label: 'Personalizado' },
]

export function ReportsPage() {
  const [kind, setKind] = useState<PeriodKind>('month')
  const [anchor, setAnchor] = useState<PeriodAnchor>(() => {
    const d = new Date()
    return { year: d.getFullYear(), month: d.getMonth() + 1 }
  })
  const [customFrom, setCustomFrom] = useState(() => todayISO(new Date(new Date().getFullYear(), new Date().getMonth(), 1)))
  const [customTo, setCustomTo] = useState(todayISO())

  const range = kind === 'custom' ? { from: customFrom, to: customTo } : periodRange(kind, anchor)
  const validRange = !!range.from && !!range.to && range.from <= range.to
  const q = useQuery({ queryKey: ['report', range.from, range.to], queryFn: () => reportsApi.summary(range.from, range.to), enabled: validRange })

  const r = q.data
  const empty = r && Number(r.totals.income) === 0 && Number(r.totals.expense) === 0

  return (
    <section>
      <PageHeader
        title="Relatórios"
        subtitle="Análises por período. Consumo por data do lançamento, sem contar o pagamento da fatura duas vezes."
        action={
          validRange ? (
            <div className="flex flex-wrap gap-2">
              <a href={reportsApi.csvUrl(range.from, range.to)} download className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-white/10 bg-aco px-4 text-sm hover:bg-aco-claro">
                <Download aria-hidden className="size-4" /> CSV
              </a>
              <a href={reportsApi.pdfUrl(range.from, range.to)} download className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-white/10 bg-aco px-4 text-sm hover:bg-aco-claro">
                <FileText aria-hidden className="size-4" /> PDF
              </a>
            </div>
          ) : undefined
        }
      />

      <div className="mb-6 flex flex-wrap items-center gap-4">
        <Tabs items={KINDS} value={kind} onChange={setKind} label="Tipo de período" />
        {kind !== 'custom' ? (
          <div className="flex items-center gap-1">
            <Button variant="ghost" className="px-2" aria-label="Período anterior" onClick={() => setAnchor((a) => shiftPeriod(kind, a, -1))}><ChevronLeft aria-hidden className="size-5" /></Button>
            <h2 className="min-w-44 text-center text-base font-medium first-letter:uppercase" aria-live="polite">{periodLabel(kind, anchor)}</h2>
            <Button variant="ghost" className="px-2" aria-label="Próximo período" onClick={() => setAnchor((a) => shiftPeriod(kind, a, 1))}><ChevronRight aria-hidden className="size-5" /></Button>
          </div>
        ) : (
          <div className="flex flex-wrap items-end gap-3">
            <Field label="De"><input className={inputClass} type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} /></Field>
            <Field label="Até" error={!validRange ? 'A data final deve ser igual ou posterior à inicial.' : undefined}><input className={inputClass} type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} /></Field>
          </div>
        )}
      </div>

      {!validRange ? null : q.isPending ? <LoadingBlock label="Gerando relatório…" /> : q.isError ? (
        <ErrorBlock message="Não foi possível gerar o relatório. Verifique o período e tente novamente." onRetry={() => void q.refetch()} />
      ) : empty ? (
        <p className="rounded-xl border border-dashed border-white/15 px-6 py-14 text-center text-sm text-cinza-t">Sem movimentações neste período.</p>
      ) : (
        r && (
          <div className="flex flex-col gap-6">
            <section aria-label="Totais do período" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <Card className="p-4"><p className="text-sm text-cinza-t">Receitas</p><p className="mt-1 text-xl font-semibold tabular-nums text-salvia-t">{formatBRL(r.totals.income)}</p></Card>
              <Card className="p-4"><p className="text-sm text-cinza-t">Despesas</p><p className="mt-1 text-xl font-semibold tabular-nums">{formatBRL(r.totals.expense)}</p></Card>
              <Card className="p-4">
                <p className="text-sm text-cinza-t">Resultado</p>
                <p className={cn('mt-1 text-xl font-semibold tabular-nums', Number(r.totals.result) < 0 && 'text-queimado-t')}>{formatBRL(r.totals.result)}</p>
                {Number(r.totals.result) < 0 && <p className="text-xs font-medium text-queimado-t">Déficit no período</p>}
              </Card>
              <Card className="p-4"><p className="text-sm text-cinza-t">Renda comprometida</p><p className="mt-1 text-xl font-semibold tabular-nums">{r.totals.committed_percent === null ? '—' : `${r.totals.committed_percent.toLocaleString('pt-BR')}%`}</p><p className="text-xs text-cinza-t">Despesas ÷ receitas</p></Card>
            </section>

            <div className="grid gap-6 xl:grid-cols-2">
              <ChartCard
                title="Comparação entre meses"
                legend={[{ label: 'Receitas', color: CHART.income }, { label: 'Despesas', color: CHART.expense }]}
                summary={`Receitas e despesas por mês. ${r.monthly.map((m) => `${monthShort(m.month)}: receitas ${formatBRL(m.income)}, despesas ${formatBRL(m.expense)}`).join('; ')}.`}
                table={{
                  columns: ['Mês', 'Receitas', 'Despesas', 'Resultado', 'Var. despesas'],
                  rows: r.monthly.map((m) => [monthLong(m.month), formatBRL(m.income), formatBRL(m.expense), formatBRL(m.result), m.expense_variation_percent === null ? '—' : `${m.expense_variation_percent > 0 ? '+' : ''}${m.expense_variation_percent}%`]),
                }}
              >
                <MonthlyBars data={r.monthly.map((m) => ({ month: m.month, income: Number(m.income), expense: Number(m.expense) }))} />
              </ChartCard>
              <ChartCard
                title="Despesas por categoria"
                summary={`Despesas por categoria: ${r.expense_by_category.map((c) => `${c.name} ${c.percent}%`).join(', ')}.`}
                table={{ columns: ['Categoria', 'Valor', '%'], rows: r.expense_by_category.map((c) => [c.name, formatBRL(c.amount), `${c.percent}%`]) }}
              >
                {r.expense_by_category.length ? <CategoryDonut items={r.expense_by_category} total={r.totals.expense} /> : <p className="py-10 text-center text-sm text-cinza-t">Sem despesas no período.</p>}
              </ChartCard>
            </div>

            <Card>
              <h2 className="mb-3 text-base font-medium">Evolução mensal</h2>
              <div className="overflow-x-auto" tabIndex={0} role="region" aria-label="Tabela (role para ver mais colunas)">
                <table className="w-full min-w-xl text-sm">
                  <thead><tr className="text-left text-xs text-cinza-t">
                    <th scope="col" className="px-2 py-2 font-medium">Mês</th><th scope="col" className="px-2 py-2 text-right font-medium">Receitas</th><th scope="col" className="px-2 py-2 text-right font-medium">Despesas</th><th scope="col" className="px-2 py-2 text-right font-medium">Resultado</th><th scope="col" className="px-2 py-2 text-right font-medium">Despesas vs. mês anterior</th>
                  </tr></thead>
                  <tbody>
                    {r.monthly.map((m) => (
                      <tr key={m.month} className="border-t border-white/8">
                        <td className="px-2 py-2 first-letter:uppercase">{monthLong(m.month)}</td>
                        <td className="px-2 py-2 text-right tabular-nums">{formatBRL(m.income)}</td>
                        <td className="px-2 py-2 text-right tabular-nums">{formatBRL(m.expense)}</td>
                        <td className={cn('px-2 py-2 text-right tabular-nums', Number(m.result) < 0 && 'text-queimado-t')}>{formatBRL(m.result)}</td>
                        <td className="px-2 py-2 text-right tabular-nums">{m.expense_variation_percent === null ? '—' : `${m.expense_variation_percent > 0 ? '▲ +' : m.expense_variation_percent < 0 ? '▼ ' : ''}${m.expense_variation_percent}%`}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>

            <div className="grid gap-6 xl:grid-cols-2">
              <Card>
                <h2 className="mb-3 text-base font-medium">Gastos por cartão</h2>
                {r.by_card.length === 0 ? <p className="text-sm text-cinza-t">Nenhuma compra no cartão no período.</p> : (
                  <ul className="divide-y divide-white/8 text-sm">
                    {r.by_card.map((c) => (<li key={c.card} className="flex items-center gap-3 py-2"><span className="flex-1">{c.card}</span><span className="text-xs text-cinza-t">{c.purchases} compra(s)</span><span className="w-28 text-right tabular-nums">{formatBRL(c.amount)}</span></li>))}
                  </ul>
                )}
              </Card>
              <Card>
                <h2 className="mb-3 text-base font-medium">Maiores despesas</h2>
                {r.largest_expenses.length === 0 ? <p className="text-sm text-cinza-t">Sem despesas no período.</p> : (
                  <ul className="divide-y divide-white/8 text-sm">
                    {r.largest_expenses.map((e, i) => (<li key={i} className="flex items-center gap-3 py-2"><span className="min-w-0 flex-1 truncate">{e.description}</span><span className="text-xs text-cinza-t">{formatDate(e.date)}</span><span className="w-28 text-right tabular-nums">{formatBRL(e.amount)}</span></li>))}
                  </ul>
                )}
              </Card>
            </div>

            <div className="grid gap-6 xl:grid-cols-2">
              <Card>
                <h2 className="mb-1 text-base font-medium">Compromissos futuros</h2>
                <p className="mb-3 text-xs text-cinza-t">Próximos 6 meses a partir de hoje, independentemente do período escolhido.</p>
                <ul className="divide-y divide-white/8 text-sm">
                  {r.future_commitments.map((f) => (<li key={f.month} className="flex items-center gap-3 py-2"><span className="flex-1 first-letter:uppercase">{monthLong(f.month)}</span><span className="w-28 text-right tabular-nums">{formatBRL(f.expense)}</span><span className={cn('w-28 text-right text-xs tabular-nums', Number(f.closing_balance) < 0 ? 'text-queimado-t' : 'text-cinza-t')}>saldo {formatBRL(f.closing_balance)}</span></li>))}
                </ul>
              </Card>
              <Card>
                <h2 className="mb-3 text-base font-medium">Parcelamentos ativos</h2>
                {r.active_installments.length === 0 ? <p className="text-sm text-cinza-t">Nenhum parcelamento ativo.</p> : (
                  <ul className="divide-y divide-white/8 text-sm">
                    {r.active_installments.map((a) => (<li key={a.id} className="flex items-center gap-3 py-2"><span className="min-w-0 flex-1 truncate">{a.description}</span><Badge>{a.remaining_count} de {a.count}</Badge><span className="w-28 text-right tabular-nums">{formatBRL(a.remaining_amount)}</span></li>))}
                  </ul>
                )}
              </Card>
            </div>
          </div>
        )
      )}
    </section>
  )
}
