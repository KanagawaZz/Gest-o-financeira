import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Field, FormMessage, inputClass } from '@/components/ui/Field'
import { Modal } from '@/components/ui/Modal'
import { useToast } from '@/components/ui/Toast'
import { monthLong } from '@/lib/chart'
import { cn } from '@/lib/cn'
import { toFormErrors } from '@/lib/errors'
import { formatBRL, formatDate } from '@/lib/format'
import { todayISO } from '@/lib/money'
import { cardsApi } from '@/services/planning'
import type { CreditCard, Invoice } from '@/types/planning'
import { keys, useAccounts } from '../finance/queries'

function InvoiceDetail({ invoice, onPaid }: { invoice: Invoice; onPaid: () => void }) {
  const qc = useQueryClient()
  const toast = useToast()
  const accountsQ = useAccounts()
  const detail = useQuery({ queryKey: ['invoice', invoice.id], queryFn: () => cardsApi.invoice(invoice.id) })
  const accounts = (accountsQ.data ?? []).filter((a) => !a.is_archived)
  const [account, setAccount] = useState('')
  const [date, setDate] = useState(todayISO())
  const [paying, setPaying] = useState(false)

  const pay = useMutation({
    mutationFn: () => cardsApi.pay(invoice.id, { account: Number(account || accounts[0]?.id), date }),
    onSuccess: async () => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: ['invoice'] }), qc.invalidateQueries({ queryKey: ['invoices'] }), qc.invalidateQueries({ queryKey: ['cards'] }),
        qc.invalidateQueries({ queryKey: keys.accounts }), qc.invalidateQueries({ queryKey: keys.transactions }), qc.invalidateQueries({ queryKey: ['dashboard'] }),
      ])
      toast.success('Fatura paga. A saída foi registrada uma única vez.')
      setPaying(false)
      onPaid()
    },
  })

  if (detail.isPending) return <p className="py-4 text-sm text-cinza-t">Carregando fatura…</p>
  if (detail.isError) return <p role="alert" className="py-4 text-sm text-queimado-t">Não foi possível carregar a fatura.</p>
  const d = detail.data
  const open = d.status === 'open'
  const err = pay.isError ? toFormErrors(pay.error) : null

  return (
    <div className="mt-4 rounded-lg border border-linha/10 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-xs text-cinza-t">Fecha em {formatDate(d.closing_date)} · vence em {formatDate(d.due_date)}</p>
          <p className="mt-0.5 text-xl font-semibold tabular-nums">{formatBRL(d.total)}</p>
        </div>
        <Badge tone={open ? 'warning' : 'positive'}>{open ? 'Em aberto' : `Paga em ${d.paid_at ? formatDate(d.paid_at) : ''}`}</Badge>
      </div>
      {d.purchases.length === 0 ? (
        <p className="mt-3 text-sm text-cinza-t">Sem compras nesta fatura.</p>
      ) : (
        <ul className="mt-3 divide-y divide-linha/8 text-sm">
          {d.purchases.map((p) => (
            <li key={p.id} className="flex items-center gap-3 py-1.5">
              <span className="w-20 text-xs text-cinza-t">{formatDate(p.date)}</span>
              <span className="min-w-0 flex-1 truncate">{p.description}</span>
              <span className="text-xs text-cinza-t">{p.category_name}</span>
              <span className="w-24 text-right tabular-nums">{formatBRL(p.amount)}</span>
            </li>
          ))}
        </ul>
      )}
      {open && Number(d.total) > 0 && (
        <div className="mt-4 border-t border-linha/10 pt-4">
          {!paying ? (
            <Button onClick={() => setPaying(true)}>Pagar fatura</Button>
          ) : (
            <div className="flex flex-col gap-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Pagar com a conta">
                  <select className={inputClass} value={account || String(accounts[0]?.id ?? '')} onChange={(e) => setAccount(e.target.value)}>
                    {accounts.map((a) => (<option key={a.id} value={a.id}>{a.name}</option>))}
                  </select>
                </Field>
                <Field label="Data do pagamento">
                  <input className={inputClass} type="date" value={date} onChange={(e) => setDate(e.target.value)} />
                </Field>
              </div>
              <p className="text-xs text-cinza-t">Saem {formatBRL(d.total)} da conta. As compras desta fatura não contam como nova despesa.</p>
              {err && <FormMessage>{err.message ?? Object.values(err.fields).join(' ')}</FormMessage>}
              <div className="flex gap-3">
                <Button variant="secondary" onClick={() => setPaying(false)} disabled={pay.isPending}>Cancelar</Button>
                <Button onClick={() => pay.mutate()} disabled={pay.isPending || !accounts.length}>{pay.isPending ? 'Pagando…' : 'Confirmar pagamento'}</Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export function InvoicesModal({ card, onClose }: { card: CreditCard | null; onClose: () => void }) {
  const list = useQuery({ queryKey: ['invoices', card?.id], queryFn: () => cardsApi.invoices(card!.id), enabled: !!card })
  const [selected, setSelected] = useState<number | null>(null)
  const invoices = list.data ?? []
  const current = invoices.find((i) => i.id === selected) ?? invoices[0]

  return (
    <Modal open={card !== null} title={card ? `Faturas · ${card.name}` : 'Faturas'} onClose={onClose}>
      {list.isPending ? <p className="text-sm text-cinza-t">Carregando…</p> : list.isError ? (
        <p role="alert" className="text-sm text-queimado-t">Não foi possível carregar as faturas.</p>
      ) : invoices.length === 0 ? (
        <p className="text-sm text-cinza-t">Ainda não há faturas. Registre uma compra no cartão para gerar a primeira.</p>
      ) : (
        <>
          <ul className="flex gap-2 overflow-x-auto pb-1" aria-label="Faturas do cartão">
            {invoices.map((i) => (
              <li key={i.id}>
                <button
                  onClick={() => setSelected(i.id)}
                  aria-pressed={current?.id === i.id}
                  className={cn('flex min-h-14 flex-col items-start rounded-lg border px-3 py-2 text-left text-xs', current?.id === i.id ? 'border-suave bg-suave/15' : 'border-linha/10 hover:bg-linha/5')}
                >
                  <span className="font-medium first-letter:uppercase">{monthLong(`${i.year}-${String(i.month).padStart(2, '0')}`)}</span>
                  <span className="tabular-nums text-cinza-t">{formatBRL(i.total)}</span>
                  <span className={i.status === 'paid' ? 'text-salvia-t' : 'text-ambar-t'}>{i.status === 'paid' ? 'Paga' : 'Em aberto'}</span>
                </button>
              </li>
            ))}
          </ul>
          {current && <InvoiceDetail key={current.id} invoice={current} onPaid={() => void list.refetch()} />}
        </>
      )}
    </Modal>
  )
}
