import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ArrowDownLeft,
  ArrowLeftRight,
  ArrowUpRight,
  BadgeCheck,
  Pencil,
  Plus,
  Search,
  Trash2,
  Undo2,
} from 'lucide-react'
import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { EmptyState } from '@/components/ui/EmptyState'
import { inputClass } from '@/components/ui/Field'
import { Modal } from '@/components/ui/Modal'
import { PageHeader } from '@/components/ui/PageHeader'
import { PeriodPicker } from '@/components/ui/PeriodPicker'
import { pillGroup, pillItem } from '@/components/ui/segmented'
import { ErrorBlock, LoadingBlock } from '@/components/ui/QueryState'
import { useToast } from '@/components/ui/Toast'
import { cn } from '@/lib/cn'
import { formatBRL, formatDate } from '@/lib/format'
import { monthRange, todayISO } from '@/lib/money'
import { ApiError } from '@/services/api'
import { transactionsApi } from '@/services/finance'
import type { Transaction, TransactionFilters, TransactionInput, TxStatus, TxType } from '@/types/finance'
import { keys, useAccounts, useCategories } from '../finance/queries'
import { TransactionForm } from './TransactionForm'
import { AnimatedMoney } from '@/components/motion/AnimatedNumber'

const TYPE_FILTERS: { value: TxType | ''; label: string }[] = [
  { value: '', label: 'Todas' },
  { value: 'income', label: 'Receitas' },
  { value: 'expense', label: 'Despesas' },
  { value: 'transfer', label: 'Transferências' },
]
const TYPE_LABEL: Record<TxType, string> = { income: 'Receita', expense: 'Despesa', transfer: 'Transferência', card_payment: 'Pagamento de fatura' }

type PendingAction = { kind: 'void' | 'delete'; tx: Transaction }

function StatusBadge({ status, type }: { status: TxStatus; type: TxType }) {
  if (status === 'pending') return <Badge tone="warning">Pendente</Badge>
  if (status === 'voided') return <Badge tone="danger">Estornada</Badge>
  if (status === 'cancelled') return <Badge tone="danger">Cancelada</Badge>
  return <Badge tone="positive">{type === 'income' ? 'Recebida' : type === 'expense' ? 'Paga' : 'Realizada'}</Badge>
}

function TxIcon({ type }: { type: TxType }) {
  const Icon = type === 'income' ? ArrowDownLeft : type === 'expense' || type === 'card_payment' ? ArrowUpRight : ArrowLeftRight
  const tone = type === 'income' ? 'text-salvia-t bg-salvia/15' : type === 'expense' || type === 'card_payment' ? 'text-queimado-t bg-queimado/15' : 'text-suave-t bg-suave/15'
  return (
    <span className={cn('flex size-10 shrink-0 items-center justify-center rounded-full', tone)}>
      <Icon aria-hidden className="size-5" />
    </span>
  )
}

/** `?busca=texto&mes=AAAA-MM` (vindo da busca global) abre a tela já filtrada; mudar a URL recria a tela. */
export function TransactionsPage() {
  const [params] = useSearchParams()
  const busca = params.get('busca') ?? ''
  const mes = /^\d{4}-(0[1-9]|1[0-2])$/.test(params.get('mes') ?? '') ? params.get('mes') : null
  return <TransactionsView key={`${busca}|${mes ?? ''}`} initialSearch={busca} initialMonth={mes} />
}

function TransactionsView({ initialSearch, initialMonth }: { initialSearch: string; initialMonth: string | null }) {
  const toast = useToast()
  const qc = useQueryClient()
  const accountsQ = useAccounts()
  const categoriesQ = useCategories()

  const [ym, setYm] = useState(() => {
    if (initialMonth) {
      const [y = 0, m = 1] = initialMonth.split('-').map(Number)
      return { y, m }
    }
    const now = new Date()
    return { y: now.getFullYear(), m: now.getMonth() + 1 }
  })
  const [type, setType] = useState<TxType | ''>('')
  const [status, setStatus] = useState<TxStatus | ''>('')
  const [account, setAccount] = useState('')
  const [search, setSearch] = useState(initialSearch)
  const [page, setPage] = useState(1)
  const [editing, setEditing] = useState<Transaction | 'new' | null>(null)
  const [pending, setPending] = useState<PendingAction | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  const range = monthRange(ym.y, ym.m)
  const filters: TransactionFilters = {
    date_from: range.from,
    date_to: range.to,
    ...(type && { type }),
    ...(status && { status }),
    ...(account && { account: Number(account) }),
    ...(search.trim() && { search: search.trim() }),
  }

  const list = useQuery({
    queryKey: [...keys.transactions, 'list', filters, page],
    queryFn: () => transactionsApi.list(filters, page),
    placeholderData: keepPreviousData,
  })
  const summary = useQuery({
    queryKey: [...keys.transactions, 'summary', filters],
    queryFn: () => transactionsApi.summary(filters),
    placeholderData: keepPreviousData,
  })

  // Toda alteração pode mudar lista, totais e saldos das contas.
  const refresh = () => Promise.all([qc.invalidateQueries({ queryKey: keys.transactions }), qc.invalidateQueries({ queryKey: keys.accounts })])

  const save = async (input: TransactionInput) => {
    if (editing && editing !== 'new') await transactionsApi.update(editing.id, input)
    else await transactionsApi.create(input)
    await refresh()
    toast.success(editing === 'new' ? 'Movimentação registrada.' : 'Movimentação atualizada.')
    setEditing(null)
  }

  const settle = useMutation({
    mutationFn: (tx: Transaction) => transactionsApi.update(tx.id, { status: 'realized', settled_date: todayISO() }),
    onSuccess: async (tx) => {
      await refresh()
      toast.success(tx.type === 'income' ? 'Marcada como recebida.' : 'Marcada como paga.')
    },
    onError: (e) => setActionError(e instanceof ApiError ? e.message : 'Não foi possível concluir a operação.'),
  })

  const confirm = useMutation({
    mutationFn: async ({ kind, tx }: PendingAction): Promise<void> => {
      if (kind === 'void') await transactionsApi.void(tx.id)
      else await transactionsApi.remove(tx.id)
    },
    onSuccess: async (_d, { kind }) => {
      await refresh()
      toast.success(kind === 'void' ? 'Movimentação estornada.' : 'Movimentação excluída.')
      setPending(null)
    },
    onError: (e) => {
      setPending(null)
      setActionError(e instanceof ApiError ? e.message : 'Não foi possível concluir a operação.')
    },
  })

  function shiftMonth(delta: number) {
    const d = new Date(ym.y, ym.m - 1 + delta, 1)
    setYm({ y: d.getFullYear(), m: d.getMonth() + 1 })
    setPage(1)
  }
  const resetPage = <T,>(set: (v: T) => void) => (v: T) => {
    set(v)
    setPage(1)
  }

  const monthLabel = new Date(ym.y, ym.m - 1, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
  const accounts = accountsQ.data ?? []
  const noAccounts = accountsQ.isSuccess && accounts.filter((a) => !a.is_archived).length === 0
  const totalPages = list.data ? Math.max(1, Math.ceil(list.data.count / 25)) : 1
  const hasFilters = !!(type || status || account || search.trim())

  return (
    <section>
      <PageHeader
        title="Transações"
        subtitle="Receitas, despesas e transferências do período."
        action={
          <Button onClick={() => setEditing('new')} disabled={!accountsQ.isSuccess || !categoriesQ.isSuccess}>
            <Plus aria-hidden className="size-4" /> Nova transação
          </Button>
        }
      />

      {/* Período e totais */}
      <div className="mb-5">
        <PeriodPicker label={monthLabel} onPrev={() => shiftMonth(-1)} onNext={() => shiftMonth(1)} />
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: 'Recebido', hint: 'Receitas já recebidas', value: summary.data?.income_realized, tone: 'text-salvia-t' },
          { label: 'Pago', hint: 'Despesas já pagas', value: summary.data?.expense_realized, tone: 'text-queimado-t' },
          { label: 'A receber', hint: 'Receitas pendentes', value: summary.data?.income_pending, tone: '' },
          { label: 'A pagar', hint: 'Despesas pendentes', value: summary.data?.expense_pending, tone: '' },
        ].map((c) => (
          <Card key={c.label} className="p-4">
            <p className="text-sm text-cinza-t">{c.label}</p>
            <p className={cn('mt-1 text-xl font-semibold', c.tone)}><AnimatedMoney value={c.value ?? null} /></p>
            <p className="mt-0.5 text-xs text-cinza-t">{c.hint}</p>
          </Card>
        ))}
      </div>

      {/* Filtros */}
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center">
        <div role="tablist" aria-label="Tipo" className={cn(pillGroup, 'self-start')}>
          {TYPE_FILTERS.map((f) => (
            <button
              key={f.value}
              role="tab"
              aria-selected={type === f.value}
              onClick={() => resetPage(setType)(f.value)}
              className={pillItem(type === f.value)}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="relative flex-1">
          <Search aria-hidden className="pointer-events-none absolute left-3 top-1/2 z-10 size-4 -translate-y-1/2 text-cinza-t" />
          <input
            className={cn(inputClass, 'pl-9')}
            type="search"
            placeholder="Buscar por descrição…"
            aria-label="Buscar por descrição"
            value={search}
            onChange={(e) => resetPage(setSearch)(e.target.value)}
          />
        </div>
        <select className={cn(inputClass, 'lg:w-44')} aria-label="Situação" value={status} onChange={(e) => resetPage(setStatus)(e.target.value as TxStatus | '')}>
          <option value="">Todas as situações</option>
          <option value="realized">Realizadas</option>
          <option value="pending">Pendentes</option>
          <option value="voided">Estornadas</option>
        </select>
        <select className={cn(inputClass, 'lg:w-44')} aria-label="Conta" value={account} onChange={(e) => resetPage(setAccount)(e.target.value)}>
          <option value="">Todas as contas</option>
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
      </div>

      {actionError && (
        <p role="alert" className="surface mb-4 rounded-xl !border-queimado/35 bg-queimado/15 px-3 py-2 text-sm text-queimado-t">
          {actionError}
        </p>
      )}

      {/* Lista */}
      {noAccounts ? (
        <EmptyState
          icon={ArrowLeftRight}
          title="Cadastre uma conta primeiro"
          description="Toda movimentação acontece em uma conta. Crie sua conta corrente ou carteira para começar."
          action={
            <Link to="/contas" className="inline-flex min-h-10 items-center rounded-lg bg-suave px-4 text-sm font-medium text-on-acao hover:bg-suave-forte">
              Ir para Contas
            </Link>
          }
        />
      ) : list.isPending ? (
        <LoadingBlock />
      ) : list.isError ? (
        <ErrorBlock message="Não foi possível carregar as transações." onRetry={() => void list.refetch()} />
      ) : list.data.results.length === 0 ? (
        <EmptyState
          icon={ArrowLeftRight}
          title={hasFilters ? 'Nada encontrado com esses filtros' : 'Nenhuma movimentação neste mês'}
          description={hasFilters ? 'Ajuste ou limpe os filtros para ver mais resultados.' : 'Registre sua primeira receita ou despesa do período.'}
          action={!hasFilters ? <Button onClick={() => setEditing('new')}>Nova transação</Button> : undefined}
        />
      ) : (
        <>
          <ul className={cn('surface divide-y divide-linha/8 rounded-2xl', list.isPlaceholderData && 'opacity-60')}>
            {list.data.results.map((tx) => {
              const sign = tx.type === 'income' ? '+ ' : tx.type === 'expense' || tx.type === 'card_payment' ? '− ' : ''
              const cardRow = !!tx.credit_card || tx.type === 'card_payment' // vêm da fatura: edição limitada
              const voided = tx.status === 'voided'
              return (
                // Celular: [ícone | descrição | valor] e, embaixo, [situação ... ações]. Tablet+: uma linha só.
                <li key={tx.id} className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 px-4 py-3 md:flex md:gap-x-4">
                  <TxIcon type={tx.type} />
                  <div className="min-w-0 md:flex-1">
                    <p className={cn('truncate text-sm font-medium', voided && 'line-through opacity-70')}>{tx.description}</p>
                    {/* Data primeiro: é o que mais importa e não pode sumir quando a linha é cortada no celular. */}
                    <p className="truncate text-xs text-cinza-t">
                      {formatDate(tx.date)} · {TYPE_LABEL[tx.type]} ·{' '}
                      {tx.type === 'transfer' ? `${tx.account_name} → ${tx.destination_account_name}` : tx.credit_card ? `${tx.category_name} · Cartão ${tx.credit_card_name}` : `${tx.category_name ?? 'Fatura'} · ${tx.account_name}`}
                    </p>
                  </div>
                  <p
                    className={cn(
                      'whitespace-nowrap text-right text-sm font-semibold tabular-nums md:order-2 md:w-32',
                      tx.type === 'income' && 'text-salvia-t',
                      (tx.type === 'expense' || tx.type === 'card_payment') && 'text-queimado-t',
                      voided && 'line-through opacity-70',
                    )}
                  >
                    {sign}
                    {formatBRL(tx.amount)}
                  </p>
                  <div className="col-span-2 col-start-2 flex items-center justify-between gap-2 md:contents">
                  <span className="md:order-1">
                    <StatusBadge status={tx.status} type={tx.type} />
                  </span>
                  <div className="-mr-2 flex gap-0.5 md:order-3 md:mr-0">
                    {tx.status === 'pending' && (
                      <Button variant="ghost" className="px-2" title={tx.type === 'income' ? 'Marcar como recebida' : 'Marcar como paga'} aria-label={`${tx.type === 'income' ? 'Marcar como recebida' : 'Marcar como paga'}: ${tx.description}`} disabled={settle.isPending} onClick={() => { setActionError(null); settle.mutate(tx) }}>
                        <BadgeCheck aria-hidden className="size-4" />
                      </Button>
                    )}
                    {!voided && !cardRow && tx.status !== 'cancelled' && (
                      <Button variant="ghost" className="px-2" title="Editar" aria-label={`Editar ${tx.description}`} onClick={() => { setActionError(null); setEditing(tx) }}>
                        <Pencil aria-hidden className="size-4" />
                      </Button>
                    )}
                    {tx.status === 'realized' && !tx.credit_card && (
                      <Button variant="ghost" className="px-2" title="Estornar" aria-label={`Estornar ${tx.description}`} onClick={() => { setActionError(null); setPending({ kind: 'void', tx }) }}>
                        <Undo2 aria-hidden className="size-4" />
                      </Button>
                    )}
                    {tx.status === 'pending' && (
                      <Button variant="ghost" className="px-2" title="Excluir" aria-label={`Excluir ${tx.description}`} onClick={() => { setActionError(null); setPending({ kind: 'delete', tx }) }}>
                        <Trash2 aria-hidden className="size-4" />
                      </Button>
                    )}
                  </div>
                  </div>
                </li>
              )
            })}
          </ul>

          {totalPages > 1 && (
            <nav aria-label="Paginação" className="mt-4 flex items-center justify-center gap-3 text-sm text-cinza-t">
              <Button variant="secondary" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                Anterior
              </Button>
              <span>
                Página {page} de {totalPages}
              </span>
              <Button variant="secondary" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
                Próxima
              </Button>
            </nav>
          )}
        </>
      )}

      <Modal open={editing !== null} title={editing === 'new' ? 'Nova transação' : 'Editar transação'} onClose={() => setEditing(null)}>
        <TransactionForm
          transaction={editing && editing !== 'new' ? editing : undefined}
          accounts={accounts}
          categories={categoriesQ.data ?? []}
          onSubmit={save}
          onCancel={() => setEditing(null)}
        />
      </Modal>

      <ConfirmDialog
        open={pending !== null}
        title={pending?.kind === 'void' ? 'Estornar movimentação?' : 'Excluir movimentação?'}
        message={
          pending?.kind === 'void'
            ? `“${pending.tx.description}” deixará de afetar o saldo, mas continuará no histórico como estornada.`
            : `“${pending?.tx.description ?? ''}” é pendente e será removida definitivamente.`
        }
        confirmLabel={pending?.kind === 'void' ? 'Estornar' : 'Excluir'}
        busy={confirm.isPending}
        onConfirm={() => pending && confirm.mutate(pending)}
        onClose={() => setPending(null)}
      />
    </section>
  )
}
