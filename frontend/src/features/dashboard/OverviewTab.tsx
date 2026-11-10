import { useQuery } from '@tanstack/react-query'
import {
  AlertTriangle,
  ArrowDownToLine,
  CalendarClock,
  CalendarDays,
  ChevronRight,
  Clock3,
  Layers,
  Repeat,
  TrendingUp,
  Wallet,
  WalletCards,
  type LucideIcon,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { CategoryDonut } from '@/components/charts/CategoryDonut'
import { ChartCard } from '@/components/charts/ChartCard'
import { MonthlyBars } from '@/components/charts/MonthlyBars'
import { TrendBars } from '@/components/charts/TrendBars'
import { Badge } from '@/components/ui/Badge'
import { Card } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { ErrorBlock, LoadingBlock } from '@/components/ui/QueryState'
import { CHART, monthLong, monthShort } from '@/lib/chart'
import { cn } from '@/lib/cn'
import { formatBRL, formatDate } from '@/lib/format'
import { dashboardApi } from '@/services/planning'
import type { DashboardSummary, TrendKey } from '@/types/planning'
import { DUE_STATUS, summaryKey } from './due'

// Classes literais (o Tailwind só gera o que encontra escrito no código).
const TONES = {
  salvia: { tile: 'bg-salvia/15 text-salvia-t ring-salvia/30', bar: 'bg-linear-to-t from-salvia to-salvia-t' },
  azul: { tile: 'bg-azul/15 text-azul-t ring-azul/30', bar: 'bg-linear-to-t from-azul to-azul-t' },
  roxo: { tile: 'bg-roxo/15 text-roxo-t ring-roxo/30', bar: 'bg-linear-to-t from-roxo to-roxo-t' },
  queimado: { tile: 'bg-queimado/15 text-queimado-t ring-queimado/30', bar: 'bg-linear-to-t from-queimado to-queimado-t' },
  laranja: { tile: 'bg-laranja/15 text-laranja-t ring-laranja/30', bar: 'bg-linear-to-t from-laranja to-laranja-t' },
  turquesa: { tile: 'bg-turquesa/15 text-turquesa-t ring-turquesa/30', bar: 'bg-linear-to-t from-turquesa to-turquesa-t' },
} as const

type KpiDef = { key: TrendKey; label: string; icon: LucideIcon; tone: keyof typeof TONES; caption: string }

const KPIS: KpiDef[] = [
  { key: 'income_received', label: 'Receitas recebidas', icon: ArrowDownToLine, tone: 'salvia', caption: 'Receitas recebidas nos últimos 6 meses' },
  { key: 'income_expected', label: 'Receitas previstas', icon: CalendarDays, tone: 'azul', caption: 'Receitas pendentes nos últimos 6 meses' },
  { key: 'expense_paid', label: 'Despesas pagas', icon: Wallet, tone: 'roxo', caption: 'Despesas pagas nos últimos 6 meses' },
  { key: 'expense_pending', label: 'Despesas pendentes', icon: CalendarClock, tone: 'queimado', caption: 'Despesas pendentes nos últimos 6 meses' },
  { key: 'current_balance', label: 'Saldo atual', icon: WalletCards, tone: 'laranja', caption: 'Saldo ao fim de cada um dos últimos 6 meses' },
  { key: 'projected_balance', label: 'Saldo projetado (fim do mês)', icon: Clock3, tone: 'turquesa', caption: 'Saldo projetado ao fim deste mês e dos 5 seguintes' },
]

function Kpi({ def, s }: { def: KpiDef; s: DashboardSummary }) {
  const raw = s.indicators[def.key]
  const tone = TONES[def.tone]
  const Icon = def.icon
  const projectionMissing = def.key === 'projected_balance' && raw === null
  const negative = raw !== null && Number(raw) < 0 && (def.key === 'current_balance' || def.key === 'projected_balance')
  const hint = projectionMissing ? 'A projeção só existe para o mês atual e os próximos.' : (s.explanations[def.key] ?? '')
  const trend = s.trends?.[def.key]
  // Celular: card compacto em 2 colunas (ícone e mini-gráfico em cima). Tablet/desktop: ícone à esquerda.
  // O mini-gráfico aparece em um dos dois lugares; o oculto (display: none) não chega ao leitor de tela.
  return (
    <Card className="flex flex-col gap-3 p-4 md:flex-row md:gap-4 md:p-5">
      <div className="flex items-start justify-between gap-2">
        <span className={cn('flex size-10 shrink-0 items-center justify-center rounded-xl ring-1 md:size-14 md:rounded-2xl', tone.tile)}>
          <Icon aria-hidden className="size-5 md:size-7" strokeWidth={2} />
        </span>
        {trend && <TrendBars points={trend} colorClass={tone.bar} caption={def.caption} className="h-8 md:hidden" />}
      </div>
      <div className="min-w-0 flex-1">
        <h3 className="text-[13px] leading-tight text-branco/90 md:text-[17px]">{def.label}</h3>
        <div className="mt-0.5 flex items-end justify-between gap-3">
          <p className={cn('min-w-0 text-[19px] font-bold leading-tight tabular-nums md:text-[26px]', negative && 'text-queimado-t')}>
            {raw === null ? '—' : formatBRL(raw)}
          </p>
          {trend && <TrendBars points={trend} colorClass={tone.bar} caption={def.caption} className="mb-1 hidden shrink-0 md:flex" />}
        </div>
        {negative && <p className="mt-1 text-xs font-medium text-queimado-t">{def.key === 'current_balance' ? 'Saldo negativo' : 'Projeção negativa'}</p>}
        <p className="mt-1.5 text-xs leading-snug text-cinza-t md:mt-2 md:text-[13px]">{hint}</p>
      </div>
    </Card>
  )
}

function Committed({ percent, hint }: { percent: number; hint?: string }) {
  const level = percent > 100 ? 'over' : percent > 80 ? 'high' : 'ok'
  const fill = {
    ok: 'bg-linear-to-r from-salvia via-suave-forte to-suave-forte/70',
    high: 'bg-linear-to-r from-salvia via-ambar to-ambar',
    over: 'bg-linear-to-r from-ambar via-queimado to-queimado',
  }[level]
  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-3 text-base font-medium sm:text-[17px]">
          <TrendingUp aria-hidden className="size-6 text-suave-t" /> Renda comprometida no mês
        </h2>
        <p className="text-2xl font-bold tabular-nums">{percent.toLocaleString('pt-BR')}%</p>
      </div>
      <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-white/10" role="progressbar" aria-valuenow={Math.min(100, percent)} aria-valuemin={0} aria-valuemax={100} aria-label="Renda comprometida">
        <div className={cn('h-full rounded-full', fill)} style={{ width: `${Math.min(100, percent)}%` }} />
      </div>
      <p className="mt-3 text-[13px] text-cinza-t">
        {level === 'over' && <span className="mr-1 font-medium text-queimado-t">Acima da renda do mês.</span>}
        {level === 'high' && <span className="mr-1 font-medium text-ambar-t">Perto do limite da renda.</span>}
        {hint}
      </p>
    </Card>
  )
}

export function OverviewTab({ month }: { month: string }) {
  const q = useQuery({ queryKey: summaryKey(month), queryFn: () => dashboardApi.summary(month) })

  if (q.isPending) return <LoadingBlock label="Calculando seus indicadores…" />
  if (q.isError) return <ErrorBlock message="Não foi possível carregar o resumo financeiro." onRetry={() => void q.refetch()} />
  const s = q.data
  const i = s.indicators
  const e = s.explanations
  const totalExpense = Number(i.expense_paid) + Number(i.expense_pending)
  const noData = s.series.every((x) => Number(x.income) === 0 && Number(x.expense) === 0) && s.upcoming.length === 0

  return (
    <div className="flex flex-col gap-4 md:gap-6">
      {s.alerts.length > 0 && (
        <ul aria-label="Alertas" className="flex flex-col gap-2 md:gap-3">
          {s.alerts.map((a) => (
            <li key={a.code}>
              <Link
                to="/contas"
                className={cn(
                  'flex min-h-12 items-center gap-3 rounded-xl border px-3.5 py-2.5 text-sm backdrop-blur-xl transition-colors md:px-4 md:py-3 md:text-[15px]',
                  a.level === 'danger' ? 'border-queimado/35 bg-queimado/15 text-queimado-t hover:bg-queimado/20' : 'border-ambar/35 bg-ambar/12 text-ambar-t hover:bg-ambar/18',
                )}
              >
                <AlertTriangle aria-hidden className="size-5 shrink-0" />
                <span className="min-w-0 flex-1">
                  <span className="font-semibold">{a.level === 'danger' ? 'Atenção: ' : 'Aviso: '}</span>
                  {a.message}
                </span>
                <ChevronRight aria-hidden className="size-5 shrink-0" />
              </Link>
            </li>
          ))}
        </ul>
      )}

      <section aria-label="Indicadores" className="grid grid-cols-2 gap-3 md:gap-4 xl:grid-cols-3">
        {KPIS.map((k) => (
          <Kpi key={k.key} def={k} s={s} />
        ))}
      </section>

      {i.committed_percent !== null && <Committed percent={i.committed_percent} hint={e.committed_percent} />}

      {noData ? (
        <EmptyState
          icon={CalendarClock}
          title="Ainda não há movimentações para mostrar"
          description="Cadastre uma conta e registre receitas e despesas. Os gráficos e a projeção aparecem aqui."
          action={
            <Link to="/contas" className="inline-flex min-h-10 items-center rounded-xl bg-suave px-4 text-sm font-semibold text-marinho hover:bg-suave-forte">
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
                    const st = DUE_STATUS[u.status]
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
                  <span className="flex size-10 items-center justify-center rounded-xl bg-azul/15 text-azul-t ring-1 ring-azul/30">
                    <Repeat aria-hidden className="size-5" />
                  </span>
                  <div className="flex-1">
                    <p className="text-sm font-medium">Contas recorrentes</p>
                    <p className="text-xs text-cinza-t">{s.recurring_and_installments.recurring_count} pendente(s)</p>
                  </div>
                  <p className="text-sm font-semibold tabular-nums">{formatBRL(s.recurring_and_installments.recurring_total)}</p>
                </li>
                <li className="flex items-center gap-3">
                  <span className="flex size-10 items-center justify-center rounded-xl bg-roxo/15 text-roxo-t ring-1 ring-roxo/30">
                    <Layers aria-hidden className="size-5" />
                  </span>
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
