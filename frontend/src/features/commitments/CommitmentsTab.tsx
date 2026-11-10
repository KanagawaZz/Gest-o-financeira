import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { BadgeCheck, CalendarClock, Pencil, Plus, Repeat, Trash2, XCircle } from 'lucide-react'
import { useState } from 'react'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { EmptyState } from '@/components/ui/EmptyState'
import { Modal } from '@/components/ui/Modal'
import { ErrorBlock, LoadingBlock } from '@/components/ui/QueryState'
import { useToast } from '@/components/ui/Toast'
import { cn } from '@/lib/cn'
import { formatBRL, formatDate } from '@/lib/format'
import { todayISO } from '@/lib/money'
import { ApiError } from '@/services/api'
import { transactionsApi } from '@/services/finance'
import { commitmentsApi, recurringApi } from '@/services/planning'
import type { Transaction } from '@/types/finance'
import { FREQUENCY_LABEL, type RecurringRule } from '@/types/planning'
import { keys, useAccounts, useCategories } from '../finance/queries'
import { RuleForm, type RuleFormValue } from './RuleForm'

function untilISO(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return todayISO(d)
}
function daysFromToday(iso: string): number {
  const [y = 0, m = 1, d = 1] = iso.split('-').map(Number)
  const t = new Date()
  return Math.round((new Date(y, m - 1, d).getTime() - new Date(t.getFullYear(), t.getMonth(), t.getDate()).getTime()) / 86_400_000)
}

export function CommitmentsTab() {
  const qc = useQueryClient()
  const toast = useToast()
  const accountsQ = useAccounts()
  const categoriesQ = useCategories()
  const pendingQ = useQuery({ queryKey: [...keys.transactions, 'commitments'], queryFn: () => commitmentsApi.pending(untilISO(90)) })
  const rulesQ = useQuery({ queryKey: ['recurring'], queryFn: recurringApi.list })

  const [editing, setEditing] = useState<RecurringRule | 'new' | null>(null)
  const [ending, setEnding] = useState<RecurringRule | null>(null)
  const [removing, setRemoving] = useState<Transaction | null>(null)
  const [error, setError] = useState<string | null>(null)

  const refresh = () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: keys.transactions }),
      qc.invalidateQueries({ queryKey: keys.accounts }),
      qc.invalidateQueries({ queryKey: ['recurring'] }),
      qc.invalidateQueries({ queryKey: ['dashboard'] }),
    ])
  const fail = (e: unknown) => setError(e instanceof ApiError ? e.message : 'Não foi possível concluir a operação.')

  const settle = useMutation({
    mutationFn: (tx: Transaction) => transactionsApi.update(tx.id, { status: 'realized', settled_date: todayISO() }),
    onSuccess: async (tx) => { await refresh(); toast.success(tx.type === 'income' ? 'Marcada como recebida.' : 'Marcada como paga.') },
    onError: fail,
  })
  const remove = useMutation({
    mutationFn: (tx: Transaction) => transactionsApi.remove(tx.id),
    onSuccess: async () => { await refresh(); toast.success('Compromisso removido.'); setRemoving(null) },
    onError: (e) => { setRemoving(null); fail(e) },
  })
  const endRule = useMutation({
    mutationFn: (r: RecurringRule) => recurringApi.end(r.id),
    onSuccess: async () => { await refresh(); toast.success('Regra encerrada. O histórico foi mantido.'); setEnding(null) },
    onError: (e) => { setEnding(null); fail(e) },
  })

  async function save({ once, input }: RuleFormValue) {
    if (editing && editing !== 'new') {
      await recurringApi.update(editing.id, input)
    } else if (once) {
      await transactionsApi.create({
        type: input.type, description: input.description, amount: input.amount, category: input.category, account: input.account,
        destination_account: null, date: input.start_date, competence_date: null, settled_date: null, status: 'pending', notes: input.notes,
      })  // fmt: skip
    } else {
      await recurringApi.create(input)
    }
    await refresh()
    toast.success(editing === 'new' ? 'Compromisso cadastrado.' : 'Compromisso atualizado.')
    setEditing(null)
  }

  const pending = pendingQ.data ?? []
  const rules = rulesQ.data ?? []
  const noAccounts = accountsQ.isSuccess && accountsQ.data.filter((a) => !a.is_archived).length === 0

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-xl text-sm text-cinza-t">Contas fixas, variáveis e pontuais. Pendentes não alteram o saldo até serem marcadas como pagas.</p>
        <Button onClick={() => setEditing('new')} disabled={!accountsQ.isSuccess || !categoriesQ.isSuccess || noAccounts}>
          <Plus aria-hidden className="size-4" /> Novo compromisso
        </Button>
      </div>
      {noAccounts && <p className="rounded-lg bg-ambar/15 px-3 py-2 text-sm text-ambar-t">Cadastre uma conta financeira antes de criar compromissos.</p>}
      {error && <p role="alert" className="rounded-lg bg-queimado/15 px-3 py-2 text-sm text-queimado-t">{error}</p>}

      <section aria-labelledby="pend-title">
        <h2 id="pend-title" className="mb-3 text-base font-medium">A pagar e a receber (até 90 dias)</h2>
        {pendingQ.isPending ? <LoadingBlock /> : pendingQ.isError ? (
          <ErrorBlock message="Não foi possível carregar os compromissos." onRetry={() => void pendingQ.refetch()} />
        ) : pending.length === 0 ? (
          <EmptyState icon={CalendarClock} title="Nenhum compromisso pendente" description="Cadastre contas fixas, assinaturas ou vencimentos pontuais para acompanhá-los aqui." />
        ) : (
          <ul className="surface divide-y divide-white/8 rounded-2xl">
            {pending.map((tx) => {
              const left = daysFromToday(tx.date)
              const overdue = left < 0
              const soon = !overdue && left <= 7
              const card = !!tx.credit_card
              return (
                <li key={tx.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
                  <div className="min-w-0 flex-1 basis-48">
                    <p className="truncate text-sm font-medium">{tx.description}</p>
                    <p className="truncate text-xs text-cinza-t">
                      {tx.category_name} · {card ? tx.credit_card_name : tx.account_name} · {formatDate(tx.date)}
                    </p>
                  </div>
                  {overdue && <Badge tone="danger">Atrasada há {Math.abs(left)} {Math.abs(left) === 1 ? 'dia' : 'dias'}</Badge>}
                  {soon && <Badge tone="warning">{left === 0 ? 'Vence hoje' : `Vence em ${left} ${left === 1 ? 'dia' : 'dias'}`}</Badge>}
                  {tx.is_estimate && <Badge>Estimada</Badge>}
                  {tx.recurring_rule && <Badge icon={<Repeat aria-hidden className="size-3" />}>Recorrente</Badge>}
                  <p className={cn('w-28 text-right text-sm font-semibold tabular-nums', tx.type === 'income' ? 'text-salvia-t' : '')}>
                    {tx.type === 'income' ? '+ ' : '− '}{formatBRL(tx.amount)}
                  </p>
                  <div className="flex gap-0.5">
                    {!card && (
                      <Button variant="ghost" className="px-2" title={tx.type === 'income' ? 'Marcar como recebida' : 'Marcar como paga'} aria-label={`${tx.type === 'income' ? 'Marcar como recebida' : 'Marcar como paga'}: ${tx.description}`} disabled={settle.isPending} onClick={() => { setError(null); settle.mutate(tx) }}>
                        <BadgeCheck aria-hidden className="size-4" />
                      </Button>
                    )}
                    <Button variant="ghost" className="px-2" title={tx.recurring_rule || tx.installment_plan || card ? 'Cancelar esta ocorrência' : 'Excluir'} aria-label={`Remover ${tx.description}`} onClick={() => { setError(null); setRemoving(tx) }}>
                      {tx.recurring_rule || tx.installment_plan || card ? <XCircle aria-hidden className="size-4" /> : <Trash2 aria-hidden className="size-4" />}
                    </Button>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      <section aria-labelledby="rules-title">
        <h2 id="rules-title" className="mb-3 text-base font-medium">Regras recorrentes</h2>
        {rulesQ.isPending ? <LoadingBlock /> : rulesQ.isError ? (
          <ErrorBlock message="Não foi possível carregar as regras." onRetry={() => void rulesQ.refetch()} />
        ) : rules.length === 0 ? (
          <p className="rounded-xl border border-dashed border-white/15 px-4 py-8 text-center text-sm text-cinza-t">Nenhuma regra recorrente. Crie um compromisso mensal ou anual e o NEXO gera os vencimentos futuros para você.</p>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {rules.map((r) => (
              <li key={r.id}>
                <Card className="flex h-full flex-col gap-2 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="min-w-0 truncate font-medium">{r.description}</h3>
                    <p className={cn('text-sm font-semibold tabular-nums', r.type === 'income' && 'text-salvia-t')}>{formatBRL(r.amount)}</p>
                  </div>
                  <p className="text-xs text-cinza-t">
                    {r.type === 'income' ? 'Receita' : 'Despesa'} · {FREQUENCY_LABEL[r.frequency]}{r.interval_days ? ` (${r.interval_days} dias)` : ''} · {r.category_name} · {r.account_name}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {r.variable && <Badge tone="warning">Valor estimado</Badge>}
                    {r.end_date && <Badge>Até {formatDate(r.end_date)}</Badge>}
                    <Badge tone="neutral">{r.next_due ? `Próximo: ${formatDate(r.next_due)}` : 'Sem próximos vencimentos'}</Badge>
                  </div>
                  <div className="mt-auto flex justify-end gap-1">
                    <Button variant="ghost" className="px-2" aria-label={`Editar ${r.description}`} onClick={() => setEditing(r)}><Pencil aria-hidden className="size-4" /></Button>
                    <Button variant="ghost" className="px-2" aria-label={`Encerrar ${r.description}`} onClick={() => setEnding(r)}><XCircle aria-hidden className="size-4" /></Button>
                  </div>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>

      <Modal open={editing !== null} title={editing === 'new' ? 'Novo compromisso' : 'Editar regra recorrente'} onClose={() => setEditing(null)}>
        <RuleForm rule={editing && editing !== 'new' ? editing : undefined} accounts={accountsQ.data ?? []} categories={categoriesQ.data ?? []} onSubmit={save} onCancel={() => setEditing(null)} />
      </Modal>
      <ConfirmDialog
        open={removing !== null}
        title={removing && (removing.recurring_rule || removing.installment_plan || removing.credit_card) ? 'Cancelar esta ocorrência?' : 'Excluir compromisso?'}
        message={removing && (removing.recurring_rule || removing.installment_plan || removing.credit_card)
          ? `“${removing.description}” será cancelada e deixará de contar nas projeções. Ela não será recriada.`
          : `“${removing?.description ?? ''}” será removida definitivamente.`}
        confirmLabel={removing && (removing.recurring_rule || removing.installment_plan || removing.credit_card) ? 'Cancelar ocorrência' : 'Excluir'}
        busy={remove.isPending}
        onConfirm={() => removing && remove.mutate(removing)}
        onClose={() => setRemoving(null)}
      />
      <ConfirmDialog
        open={ending !== null}
        title="Encerrar regra?"
        message={`“${ending?.description ?? ''}”: os vencimentos futuros ainda pendentes serão cancelados. O que já foi pago e o histórico permanecem.`}
        confirmLabel="Encerrar regra"
        busy={endRule.isPending}
        onConfirm={() => ending && endRule.mutate(ending)}
        onClose={() => setEnding(null)}
      />
    </div>
  )
}
