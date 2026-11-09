import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CircleCheck, Layers, Plus, XCircle } from 'lucide-react'
import { useState } from 'react'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { EmptyState } from '@/components/ui/EmptyState'
import { Modal } from '@/components/ui/Modal'
import { PageHeader } from '@/components/ui/PageHeader'
import { ErrorBlock, LoadingBlock } from '@/components/ui/QueryState'
import { Tabs } from '@/components/ui/Tabs'
import { useToast } from '@/components/ui/Toast'
import { monthLong } from '@/lib/chart'
import { cn } from '@/lib/cn'
import { formatBRL, formatDate } from '@/lib/format'
import { ApiError } from '@/services/api'
import { plansApi } from '@/services/planning'
import type { InstallmentPlan, PlanInput, PlanStatus } from '@/types/planning'
import { keys, useAccounts, useCategories } from '../finance/queries'
import { useCards } from '../cards/queries'
import { PlanForm } from './PlanForm'

const STATUS_BADGE: Record<PlanStatus, { tone: 'positive' | 'neutral' | 'danger'; label: string }> = {
  active: { tone: 'neutral', label: 'Ativo' },
  finished: { tone: 'positive', label: 'Quitado' },
  cancelled: { tone: 'danger', label: 'Cancelado' },
}
const ROW_STATUS: Record<string, string> = { pending: 'Pendente', realized: 'Paga', cancelled: 'Cancelada', voided: 'Estornada' }

function PlanRows({ id }: { id: number }) {
  const q = useQuery({ queryKey: ['plan', id], queryFn: () => plansApi.get(id) })
  if (q.isPending) return <p className="py-3 text-sm text-cinza-t">Carregando parcelas…</p>
  if (q.isError) return <p role="alert" className="py-3 text-sm text-queimado-t">Não foi possível carregar as parcelas.</p>
  return (
    <ul className="mt-3 divide-y divide-white/8 text-sm">
      {q.data.installments?.map((r) => (
        <li key={r.id} className="flex items-center gap-3 py-1.5">
          <span className="w-8 text-xs text-cinza-t">{r.installment_number}ª</span>
          <span className="w-24 text-xs text-cinza-t">{formatDate(r.date)}</span>
          <span className="flex-1 tabular-nums">{formatBRL(r.amount)}</span>
          <Badge tone={r.status === 'realized' ? 'positive' : r.status === 'pending' ? 'neutral' : 'danger'}>{ROW_STATUS[r.status] ?? r.status}</Badge>
        </li>
      ))}
    </ul>
  )
}

export function InstallmentsPage() {
  const qc = useQueryClient()
  const toast = useToast()
  const accountsQ = useAccounts()
  const categoriesQ = useCategories()
  const cardsQ = useCards()
  const [status, setStatus] = useState<PlanStatus>('active')
  const [creating, setCreating] = useState(false)
  const [expanded, setExpanded] = useState<number | null>(null)
  const [action, setAction] = useState<{ kind: 'payoff' | 'cancel'; plan: InstallmentPlan } | null>(null)
  const [error, setError] = useState<string | null>(null)

  const summary = useQuery({ queryKey: ['plans', 'summary'], queryFn: plansApi.summary })
  const list = useQuery({ queryKey: ['plans', 'list', status], queryFn: () => plansApi.list(status) })

  const refresh = () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: ['plans'] }),
      qc.invalidateQueries({ queryKey: ['plan'] }),
      qc.invalidateQueries({ queryKey: keys.transactions }),
      qc.invalidateQueries({ queryKey: keys.accounts }),
      qc.invalidateQueries({ queryKey: ['dashboard'] }),
      qc.invalidateQueries({ queryKey: ['cards'] }),
    ])

  const run = useMutation({
    mutationFn: ({ kind, plan }: { kind: 'payoff' | 'cancel'; plan: InstallmentPlan }) => (kind === 'payoff' ? plansApi.payoff(plan.id) : plansApi.cancel(plan.id)),
    onSuccess: async (_d, { kind }) => {
      await refresh()
      toast.success(kind === 'payoff' ? 'Parcelamento quitado. O evento foi registrado.' : 'Parcelamento cancelado. O que foi pago permanece no histórico.')
      setAction(null)
    },
    onError: (e) => {
      setAction(null)
      setError(e instanceof ApiError ? (e.details ? Object.values(e.details).flat().join(' ') : e.message) : 'Não foi possível concluir a operação.')
    },
  })

  async function create(input: PlanInput) {
    await plansApi.create(input)
    await refresh()
    toast.success('Parcelamento criado com todas as parcelas.')
    setCreating(false)
  }

  const s = summary.data
  const plans = list.data ?? []

  return (
    <section>
      <PageHeader
        title="Parcelamentos"
        subtitle="Compras parceladas e as parcelas que ainda vão vencer."
        action={
          <Button onClick={() => setCreating(true)} disabled={!accountsQ.isSuccess || !categoriesQ.isSuccess || !cardsQ.isSuccess}>
            <Plus aria-hidden className="size-4" /> Nova compra parcelada
          </Button>
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Card className="p-4"><p className="text-sm text-cinza-t">Total ainda comprometido</p><p className="mt-1 text-xl font-semibold tabular-nums">{s ? formatBRL(s.committed_total) : '—'}</p><p className="mt-0.5 text-xs text-cinza-t">Parcelas pendentes</p></Card>
        <Card className="p-4"><p className="text-sm text-cinza-t">Parcelas deste mês</p><p className="mt-1 text-xl font-semibold tabular-nums">{s ? formatBRL(s.this_month) : '—'}</p><p className="mt-0.5 text-xs text-cinza-t">A vencer no mês</p></Card>
        <Card className="p-4"><p className="text-sm text-cinza-t">Parcelamentos ativos</p><p className="mt-1 text-xl font-semibold">{s ? s.active_plans : '—'}</p><p className="mt-0.5 text-xs text-cinza-t">Com parcelas pendentes</p></Card>
        <Card className="p-4">
          <p className="text-sm text-cinza-t">Progresso de quitação</p>
          <p className="mt-1 text-xl font-semibold">{s ? `${s.progress_percent}%` : '—'}</p>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10" role="progressbar" aria-valuenow={s?.progress_percent ?? 0} aria-valuemin={0} aria-valuemax={100} aria-label="Progresso geral de quitação">
            <div className="h-full rounded-full bg-salvia" style={{ width: `${s?.progress_percent ?? 0}%` }} />
          </div>
        </Card>
      </div>

      {s && s.next_months.some((m) => Number(m.amount) > 0) && (
        <Card className="mb-6">
          <h2 className="mb-3 text-base font-medium">Compromissos dos próximos meses</h2>
          <ul className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-3 lg:grid-cols-6">
            {s.next_months.map((m) => (
              <li key={m.month}><p className="text-xs first-letter:uppercase text-cinza-t">{monthLong(m.month)}</p><p className="tabular-nums">{formatBRL(m.amount)}</p></li>
            ))}
          </ul>
        </Card>
      )}

      <div className="mb-4">
        <Tabs label="Situação" value={status} onChange={setStatus} items={[{ value: 'active', label: 'Ativos' }, { value: 'finished', label: 'Encerrados' }, { value: 'cancelled', label: 'Cancelados' }]} />
      </div>
      {error && <p role="alert" className="mb-4 rounded-lg bg-queimado/15 px-3 py-2 text-sm text-queimado-t">{error}</p>}

      {list.isPending ? <LoadingBlock /> : list.isError ? (
        <ErrorBlock message="Não foi possível carregar os parcelamentos." onRetry={() => void list.refetch()} />
      ) : plans.length === 0 ? (
        <EmptyState icon={Layers} title={status === 'active' ? 'Nenhum parcelamento ativo' : 'Nada por aqui'} description="Registre uma compra parcelada e acompanhe cada parcela até a quitação."
          action={status === 'active' ? <Button onClick={() => setCreating(true)}>Nova compra parcelada</Button> : undefined} />
      ) : (
        <ul className="flex flex-col gap-3">
          {plans.map((p) => {
            const b = STATUS_BADGE[p.status]
            return (
              <li key={p.id}>
                <Card>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h2 className="truncate font-medium">{p.description}</h2>
                      <p className="mt-0.5 text-xs text-cinza-t">{p.count}× de {formatBRL(Number(p.total_amount) / p.count)} · {p.credit_card_name ? `Cartão ${p.credit_card_name}` : p.account_name} · {p.category_name}</p>
                    </div>
                    <Badge tone={b.tone}>{b.label}</Badge>
                  </div>
                  <div className="mt-4 flex items-center gap-3">
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/10" role="progressbar" aria-valuenow={p.progress_percent} aria-valuemin={0} aria-valuemax={100} aria-label={`Progresso de ${p.description}`}>
                      <div className="h-full rounded-full bg-salvia" style={{ width: `${p.progress_percent}%` }} />
                    </div>
                    <span className="text-sm tabular-nums text-cinza-t">{p.paid_count}/{p.count}</span>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                    <p className="text-sm"><span className="text-cinza-t">Restante: </span><span className={cn('font-semibold tabular-nums')}>{formatBRL(p.remaining_amount)}</span> <span className="text-xs text-cinza-t">de {formatBRL(p.total_amount)}</span></p>
                    <div className="flex flex-wrap gap-1">
                      <Button variant="ghost" onClick={() => setExpanded(expanded === p.id ? null : p.id)} aria-expanded={expanded === p.id}>{expanded === p.id ? 'Ocultar parcelas' : 'Ver parcelas'}</Button>
                      {p.status === 'active' && !p.credit_card && <Button variant="ghost" onClick={() => { setError(null); setAction({ kind: 'payoff', plan: p }) }}><CircleCheck aria-hidden className="size-4" /> Quitar</Button>}
                      {p.status === 'active' && <Button variant="ghost" onClick={() => { setError(null); setAction({ kind: 'cancel', plan: p }) }}><XCircle aria-hidden className="size-4" /> Cancelar</Button>}
                    </div>
                  </div>
                  {expanded === p.id && <PlanRows id={p.id} />}
                </Card>
              </li>
            )
          })}
        </ul>
      )}

      <Modal open={creating} title="Nova compra parcelada" onClose={() => setCreating(false)}>
        <PlanForm accounts={accountsQ.data ?? []} cards={cardsQ.data ?? []} categories={categoriesQ.data ?? []} onSubmit={create} onCancel={() => setCreating(false)} />
      </Modal>
      <ConfirmDialog
        open={action !== null}
        title={action?.kind === 'payoff' ? 'Quitar antecipadamente?' : 'Cancelar parcelamento?'}
        message={action?.kind === 'payoff'
          ? `Todas as parcelas pendentes de “${action.plan.description}” (${formatBRL(action.plan.remaining_amount)}) serão marcadas como pagas hoje e saem do saldo da conta. O evento fica registrado.`
          : `As parcelas pendentes de “${action?.plan.description ?? ''}” serão canceladas. O que já foi pago permanece no histórico.`}
        confirmLabel={action?.kind === 'payoff' ? 'Quitar agora' : 'Cancelar parcelamento'}
        busy={run.isPending}
        onConfirm={() => action && run.mutate(action)}
        onClose={() => setAction(null)}
      />
    </section>
  )
}
