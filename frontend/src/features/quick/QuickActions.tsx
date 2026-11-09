import { useQueryClient } from '@tanstack/react-query'
import { ArrowDownLeft, ArrowUpRight, ChevronDown, Layers, Plus, Wallet } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { useToast } from '@/components/ui/Toast'
import { transactionsApi, accountsApi } from '@/services/finance'
import { plansApi } from '@/services/planning'
import type { AccountInput, TransactionInput, TxType } from '@/types/finance'
import type { PlanInput } from '@/types/planning'
import { AccountForm } from '../accounts/AccountForm'
import { useCards } from '../cards/queries'
import { useAccounts, useCategories } from '../finance/queries'
import { PlanForm } from '../installments/PlanForm'
import { TransactionForm } from '../transactions/TransactionForm'

type Action = { kind: 'tx'; type: TxType } | { kind: 'account' } | { kind: 'plan' }

/** Ações rápidas globais (plano §3): nova despesa, receita, conta e compra parcelada. */
export function QuickActions() {
  const qc = useQueryClient()
  const toast = useToast()
  const accountsQ = useAccounts()
  const categoriesQ = useCategories()
  const cardsQ = useCards()
  const [menu, setMenu] = useState(false)
  const [action, setAction] = useState<Action | null>(null)
  const wrap = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!menu) return
    const onDown = (e: MouseEvent) => !wrap.current?.contains(e.target as Node) && setMenu(false)
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setMenu(false)
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [menu])

  const refresh = () =>
    Promise.all(['transactions', 'accounts', 'plans', 'plan', 'dashboard', 'cards', 'report'].map((k) => qc.invalidateQueries({ queryKey: [k] })))
  const done = async (msg: string) => {
    await refresh()
    toast.success(msg)
    setAction(null)
  }

  const items: { label: string; icon: typeof Plus; action: Action }[] = [
    { label: 'Nova despesa', icon: ArrowUpRight, action: { kind: 'tx', type: 'expense' } },
    { label: 'Nova receita', icon: ArrowDownLeft, action: { kind: 'tx', type: 'income' } },
    { label: 'Nova conta', icon: Wallet, action: { kind: 'account' } },
    { label: 'Nova compra parcelada', icon: Layers, action: { kind: 'plan' } },
  ]
  const ready = accountsQ.isSuccess && categoriesQ.isSuccess && cardsQ.isSuccess

  return (
    <>
      <div ref={wrap} className="relative">
        <Button onClick={() => setMenu((v) => !v)} aria-haspopup="menu" aria-expanded={menu}>
          <Plus aria-hidden className="size-4" /> Novo <ChevronDown aria-hidden className="size-4" />
        </Button>
        {menu && (
          <ul role="menu" aria-label="Ações rápidas" className="absolute right-0 z-30 mt-2 w-60 overflow-hidden rounded-xl border border-white/10 bg-aco p-1 shadow-xl">
            {items.map(({ label, icon: Icon, action: a }) => (
              <li key={label} role="none">
                <button
                  role="menuitem"
                  disabled={!ready}
                  onClick={() => { setMenu(false); setAction(a) }}
                  className="flex min-h-11 w-full items-center gap-3 rounded-lg px-3 text-left text-sm hover:bg-white/5 disabled:opacity-50"
                >
                  <Icon aria-hidden className="size-4 text-suave-t" /> {label}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <Modal open={action?.kind === 'tx'} title={action?.kind === 'tx' && action.type === 'income' ? 'Nova receita' : 'Nova despesa'} onClose={() => setAction(null)}>
        {action?.kind === 'tx' && (
          <TransactionForm
            initialType={action.type}
            accounts={accountsQ.data ?? []}
            categories={categoriesQ.data ?? []}
            onSubmit={async (i: TransactionInput) => { await transactionsApi.create(i); await done('Movimentação registrada.') }}
            onCancel={() => setAction(null)}
          />
        )}
      </Modal>
      <Modal open={action?.kind === 'account'} title="Nova conta" onClose={() => setAction(null)}>
        <AccountForm onSubmit={async (i: AccountInput) => { await accountsApi.create(i); await done('Conta criada.') }} onCancel={() => setAction(null)} />
      </Modal>
      <Modal open={action?.kind === 'plan'} title="Nova compra parcelada" onClose={() => setAction(null)}>
        <PlanForm
          accounts={accountsQ.data ?? []}
          cards={cardsQ.data ?? []}
          categories={categoriesQ.data ?? []}
          onSubmit={async (i: PlanInput) => { await plansApi.create(i); await done('Parcelamento criado com todas as parcelas.') }}
          onCancel={() => setAction(null)}
        />
      </Modal>
    </>
  )
}
