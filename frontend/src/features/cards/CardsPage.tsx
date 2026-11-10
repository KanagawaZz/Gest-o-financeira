import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Archive, CreditCard as CardIcon, Pencil, Plus, Receipt, ShoppingBag } from 'lucide-react'
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
import { cn } from '@/lib/cn'
import { formatBRL, formatDate } from '@/lib/format'
import { cardsApi } from '@/services/planning'
import type { CardInput, CreditCard, PurchaseInput } from '@/types/planning'
import { keys, useCategories } from '../finance/queries'
import { CardForm, PurchaseForm } from './CardForms'
import { InvoicesModal } from './InvoicesModal'
import { useCards } from './queries'

export function CardsPage() {
  const q = useCards()
  const categoriesQ = useCategories()
  const qc = useQueryClient()
  const toast = useToast()
  const [editing, setEditing] = useState<CreditCard | 'new' | null>(null)
  const [buying, setBuying] = useState<CreditCard | null>(null)
  const [viewing, setViewing] = useState<CreditCard | null>(null)
  const [archiving, setArchiving] = useState<CreditCard | null>(null)

  const refresh = () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: ['cards'] }), qc.invalidateQueries({ queryKey: ['invoices'] }), qc.invalidateQueries({ queryKey: ['plans'] }),
      qc.invalidateQueries({ queryKey: keys.transactions }), qc.invalidateQueries({ queryKey: ['dashboard'] }),
    ])

  const archive = useMutation({
    mutationFn: (c: CreditCard) => cardsApi.update(c.id, { is_archived: true }),
    onSuccess: async () => { await refresh(); toast.success('Cartão arquivado. O histórico foi mantido.'); setArchiving(null) },
    onError: () => setArchiving(null),
  })

  async function saveCard(input: CardInput) {
    if (editing && editing !== 'new') await cardsApi.update(editing.id, input)
    else await cardsApi.create(input)
    await refresh()
    toast.success(editing === 'new' ? 'Cartão cadastrado.' : 'Cartão atualizado.')
    setEditing(null)
  }
  async function buy(input: PurchaseInput) {
    if (!buying) return
    await cardsApi.purchase(buying.id, input)
    await refresh()
    toast.success(input.installments > 1 ? 'Compra parcelada registrada nas próximas faturas.' : 'Compra registrada na fatura.')
    setBuying(null)
  }

  const cards = q.data ?? []

  return (
    <section>
      <PageHeader
        title="Cartões"
        subtitle="Limite, faturas e compras. A compra é despesa; o pagamento da fatura é só a saída do dinheiro."
        action={<Button onClick={() => setEditing('new')}><Plus aria-hidden className="size-4" /> Novo cartão</Button>}
      />

      {q.isPending ? <LoadingBlock shape="cards" /> : q.isError ? (
        <ErrorBlock message="Não foi possível carregar os cartões." onRetry={() => void q.refetch()} />
      ) : cards.length === 0 ? (
        <EmptyState icon={CardIcon} title="Nenhum cartão cadastrado" description="Cadastre um cartão com limite, dia de fechamento e vencimento para acompanhar suas faturas." action={<Button onClick={() => setEditing('new')}>Novo cartão</Button>} />
      ) : (
        <ul className="grid gap-4 md:grid-cols-2">
          {cards.map((c) => {
            const used = Number(c.limit_used)
            const limit = Number(c.credit_limit)
            const pct = limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0
            const inv = c.current_invoice
            return (
              <li key={c.id}>
                <Card className="flex h-full flex-col gap-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-2">
                      <span aria-hidden className="size-3 shrink-0 rounded-full" style={{ background: c.color }} />
                      <div className="min-w-0">
                        <h2 className="truncate font-medium">{c.name}</h2>
                        {c.institution && <p className="truncate text-xs text-cinza-t">{c.institution}</p>}
                      </div>
                    </div>
                    <p className="text-xs text-cinza-t">Fecha dia {c.closing_day} · vence dia {c.due_day}</p>
                  </div>

                  <div>
                    <div className="flex items-baseline justify-between text-sm">
                      <span className="text-cinza-t">Limite utilizado</span>
                      <span className="tabular-nums">{formatBRL(c.limit_used)} <span className="text-xs text-cinza-t">de {formatBRL(c.credit_limit)}</span></span>
                    </div>
                    <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-linha/10" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={`Limite utilizado de ${c.name}`}>
                      <div className={cn('bar-fill h-full rounded-full', pct >= 90 ? 'bg-queimado' : pct >= 70 ? 'bg-ambar' : 'bg-suave')} style={{ width: `${pct}%` }} />
                    </div>
                    <p className="mt-1 text-xs text-cinza-t">Disponível: <span className={cn('tabular-nums', Number(c.limit_available) < 0 && 'text-queimado-t')}>{formatBRL(c.limit_available)}</span>{pct >= 90 && <span className="ml-2 font-medium text-queimado-t">{Number(c.limit_available) < 0 ? 'Limite excedido' : 'Limite quase no fim'}</span>}</p>
                  </div>

                  <div className="flex items-center justify-between rounded-lg bg-marinho/60 px-3 py-2.5">
                    <div>
                      <p className="text-xs text-cinza-t">Fatura atual · vence em {formatDate(inv.due_date)}</p>
                      <p className="text-lg font-semibold tabular-nums">{formatBRL(inv.total)}</p>
                    </div>
                    <Badge tone={inv.status === 'paid' ? 'positive' : Number(inv.total) > 0 ? 'warning' : 'neutral'}>{inv.status === 'paid' ? 'Paga' : Number(inv.total) > 0 ? 'Em aberto' : 'Sem compras'}</Badge>
                  </div>

                  <div className="mt-auto flex flex-wrap justify-between gap-2">
                    <div className="flex gap-1">
                      <Button variant="secondary" onClick={() => setBuying(c)}><ShoppingBag aria-hidden className="size-4" /> Nova compra</Button>
                      <Button variant="secondary" onClick={() => setViewing(c)}><Receipt aria-hidden className="size-4" /> Faturas</Button>
                    </div>
                    <div className="flex gap-1">
                      <Button variant="ghost" className="px-2" aria-label={`Editar ${c.name}`} onClick={() => setEditing(c)}><Pencil aria-hidden className="size-4" /></Button>
                      <Button variant="ghost" className="px-2" aria-label={`Arquivar ${c.name}`} onClick={() => setArchiving(c)}><Archive aria-hidden className="size-4" /></Button>
                    </div>
                  </div>
                </Card>
              </li>
            )
          })}
        </ul>
      )}

      <Modal open={editing !== null} title={editing === 'new' ? 'Novo cartão' : 'Editar cartão'} onClose={() => setEditing(null)}>
        <CardForm card={editing && editing !== 'new' ? editing : undefined} onSubmit={saveCard} onCancel={() => setEditing(null)} />
      </Modal>
      <Modal open={buying !== null} title="Nova compra no cartão" onClose={() => setBuying(null)}>
        {buying && <PurchaseForm card={buying} categories={categoriesQ.data ?? []} onSubmit={buy} onCancel={() => setBuying(null)} />}
      </Modal>
      <InvoicesModal card={viewing} onClose={() => setViewing(null)} />
      <ConfirmDialog
        open={archiving !== null}
        title="Arquivar cartão?"
        message={`“${archiving?.name ?? ''}” deixa de aceitar novas compras. Faturas e histórico continuam consultáveis.`}
        confirmLabel="Arquivar"
        busy={archive.isPending}
        onConfirm={() => archiving && archive.mutate(archiving)}
        onClose={() => setArchiving(null)}
      />
    </section>
  )
}
