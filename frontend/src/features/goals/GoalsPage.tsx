import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Archive, PiggyBank, Pencil, Plus, Target, Undo2 } from 'lucide-react'
import { useState } from 'react'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { EmptyState } from '@/components/ui/EmptyState'
import { Modal } from '@/components/ui/Modal'
import { PageHeader } from '@/components/ui/PageHeader'
import { ErrorBlock, LoadingBlock } from '@/components/ui/QueryState'
import { useToast } from '@/components/ui/Toast'
import { formatBRL, formatDate } from '@/lib/format'
import { goalsApi } from '@/services/planning'
import type { ContributionInput, Goal, GoalInput } from '@/types/planning'
import { PRIORITY_LABEL } from '@/types/planning'
import { keys, useAccounts } from '../finance/queries'
import { ContributionForm, GoalForm } from './GoalForms'
import { AnimatedMoney } from '@/components/motion/AnimatedNumber'

function Contributions({ goal, onVoid }: { goal: Goal; onVoid: (cid: number) => void }) {
  const q = useQuery({ queryKey: ['goal-contributions', goal.id], queryFn: () => goalsApi.contributions(goal.id) })
  if (q.isPending) return <p className="mt-3 text-sm text-cinza-t">Carregando aportes…</p>
  if (q.isError) return <p role="alert" className="mt-3 text-sm text-queimado-t">Não foi possível carregar os aportes.</p>
  if (!q.data.length) return <p className="mt-3 text-sm text-cinza-t">Nenhum aporte ainda.</p>
  return (
    <ul className="mt-3 divide-y divide-linha/8 text-sm">
      {q.data.map((c) => (
        <li key={c.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2">
          <span className="w-20 text-xs text-cinza-t">{formatDate(c.date)}</span>
          <span className="min-w-0 flex-1 truncate text-xs text-cinza-t">{c.account_name} → {c.destination_account_name}</span>
          <span className="tabular-nums">{formatBRL(c.amount)}</span>
          {c.status === 'realized' ? (
            <Button variant="ghost" className="px-2" aria-label={`Estornar aporte de ${formatBRL(c.amount)}`} onClick={() => onVoid(c.id)}><Undo2 aria-hidden className="size-4" /></Button>
          ) : (
            <Badge tone="danger">Estornado</Badge>
          )}
        </li>
      ))}
    </ul>
  )
}

export function GoalsPage() {
  const q = useQuery({ queryKey: ['goals'], queryFn: goalsApi.list })
  const accountsQ = useAccounts()
  const qc = useQueryClient()
  const toast = useToast()
  const [editing, setEditing] = useState<Goal | 'new' | null>(null)
  const [saving, setSaving] = useState<Goal | null>(null)
  const [archiving, setArchiving] = useState<Goal | null>(null)
  const [voiding, setVoiding] = useState<{ goal: Goal; cid: number } | null>(null)
  const [open, setOpen] = useState<number | null>(null)

  const refresh = () => Promise.all([
    qc.invalidateQueries({ queryKey: ['goals'] }), qc.invalidateQueries({ queryKey: ['goal-contributions'] }),
    qc.invalidateQueries({ queryKey: keys.accounts }), qc.invalidateQueries({ queryKey: keys.transactions }), qc.invalidateQueries({ queryKey: ['dashboard'] }),
  ])

  const archive = useMutation({
    mutationFn: (g: Goal) => goalsApi.update(g.id, { is_archived: true }),
    onSuccess: async () => { await refresh(); toast.success('Meta arquivada.'); setArchiving(null) },
    onError: () => setArchiving(null),
  })
  const voidIt = useMutation({
    mutationFn: ({ goal, cid }: { goal: Goal; cid: number }) => goalsApi.voidContribution(goal.id, cid),
    onSuccess: async () => { await refresh(); toast.success('Aporte estornado. O dinheiro volta para a conta de origem.'); setVoiding(null) },
    onError: () => setVoiding(null),
  })

  async function saveGoal(input: GoalInput) {
    if (editing && editing !== 'new') await goalsApi.update(editing.id, input)
    else await goalsApi.create(input)
    await refresh()
    toast.success(editing === 'new' ? 'Meta criada.' : 'Meta atualizada.')
    setEditing(null)
  }
  async function contribute(input: ContributionInput) {
    if (!saving) return
    await goalsApi.contribute(saving.id, input)
    await refresh()
    toast.success('Dinheiro guardado: a transferência foi registrada.')
    setSaving(null)
  }

  const goals = q.data ?? []

  return (
    <section>
      <PageHeader
        title="Metas"
        subtitle="Objetivos financeiros. O progresso só conta dinheiro realmente guardado, com transferência registrada."
        action={<Button onClick={() => setEditing('new')}><Plus aria-hidden className="size-4" /> Nova meta</Button>}
      />
      {q.isPending ? <LoadingBlock shape="cards" /> : q.isError ? (
        <ErrorBlock message="Não foi possível carregar as metas." onRetry={() => void q.refetch()} />
      ) : goals.length === 0 ? (
        <EmptyState icon={Target} title="Nenhuma meta criada" description="Defina um objetivo, como uma reserva de emergência ou uma viagem, e acompanhe quanto falta guardar por mês." action={<Button onClick={() => setEditing('new')}>Nova meta</Button>} />
      ) : (
        <ul className="grid gap-4 lg:grid-cols-2">
          {goals.map((g) => {
            const p = g.progress
            const done = p.progress_percent >= 100
            return (
              <li key={g.id}>
                <Card className="flex h-full flex-col gap-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h2 className="truncate font-medium">{g.name}</h2>
                      <p className="mt-0.5 text-xs text-cinza-t">{g.target_date ? `Até ${formatDate(g.target_date)}` : 'Sem data-alvo'} · Prioridade {PRIORITY_LABEL[g.priority].toLowerCase()}</p>
                    </div>
                    {done ? <Badge tone="positive">Meta atingida</Badge> : <Badge>{p.progress_percent}%</Badge>}
                  </div>
                  <div>
                    <div className="flex items-baseline justify-between text-sm">
                      <AnimatedMoney value={p.current_amount} className="font-semibold" />
                      <span className="text-xs text-cinza-t">de {formatBRL(g.target_amount)}</span>
                    </div>
                    <div className="mt-1.5 h-2.5 overflow-hidden rounded-full bg-linha/10" role="progressbar" aria-valuenow={p.progress_percent} aria-valuemin={0} aria-valuemax={100} aria-label={`Progresso da meta ${g.name}`}>
                      <div className="bar-fill h-full rounded-full bg-salvia" style={{ width: `${p.progress_percent}%` }} />
                    </div>
                  </div>
                  {p.monthly_needed && !done && (
                    <p className="rounded-lg bg-marinho/60 px-3 py-2 text-sm">
                      Guarde <strong className="font-semibold tabular-nums">{formatBRL(p.monthly_needed)}</strong> por mês
                      <span className="text-cinza-t"> nos próximos {p.months_left} {p.months_left === 1 ? 'mês' : 'meses'}.</span>
                    </p>
                  )}
                  <div className="mt-auto flex flex-wrap items-center justify-between gap-2">
                    <div className="flex gap-1">
                      <Button onClick={() => setSaving(g)} disabled={done}><PiggyBank aria-hidden className="size-4" /> Guardar dinheiro</Button>
                      <Button variant="ghost" onClick={() => setOpen(open === g.id ? null : g.id)} aria-expanded={open === g.id}>Aportes</Button>
                    </div>
                    <div className="flex gap-1">
                      <Button variant="ghost" className="px-2" aria-label={`Editar ${g.name}`} onClick={() => setEditing(g)}><Pencil aria-hidden className="size-4" /></Button>
                      <Button variant="ghost" className="px-2" aria-label={`Arquivar ${g.name}`} onClick={() => setArchiving(g)}><Archive aria-hidden className="size-4" /></Button>
                    </div>
                  </div>
                  {open === g.id && <Contributions goal={g} onVoid={(cid) => setVoiding({ goal: g, cid })} />}
                </Card>
              </li>
            )
          })}
        </ul>
      )}

      <Modal open={editing !== null} title={editing === 'new' ? 'Nova meta' : 'Editar meta'} onClose={() => setEditing(null)}>
        <GoalForm goal={editing && editing !== 'new' ? editing : undefined} onSubmit={saveGoal} onCancel={() => setEditing(null)} />
      </Modal>
      <Modal open={saving !== null} title="Guardar dinheiro" onClose={() => setSaving(null)}>
        {saving && <ContributionForm goal={saving} accounts={accountsQ.data ?? []} onSubmit={contribute} onCancel={() => setSaving(null)} />}
      </Modal>
      <ConfirmDialog open={archiving !== null} title="Arquivar meta?" message={`“${archiving?.name ?? ''}” sai da lista, mas os aportes e transferências continuam no histórico.`} confirmLabel="Arquivar" busy={archive.isPending} onConfirm={() => archiving && archive.mutate(archiving)} onClose={() => setArchiving(null)} />
      <ConfirmDialog open={voiding !== null} title="Estornar aporte?" message="A transferência será estornada: o valor volta para a conta de origem e deixa de contar na meta. O registro permanece no histórico." confirmLabel="Estornar" busy={voidIt.isPending} onConfirm={() => voiding && voidIt.mutate(voiding)} onClose={() => setVoiding(null)} />
    </section>
  )
}
