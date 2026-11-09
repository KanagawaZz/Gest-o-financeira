import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Archive, ArchiveRestore, Pencil, Plus, Wallet } from 'lucide-react'
import { useState } from 'react'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { Modal } from '@/components/ui/Modal'
import { PageHeader } from '@/components/ui/PageHeader'
import { ErrorBlock, LoadingBlock } from '@/components/ui/QueryState'
import { useToast } from '@/components/ui/Toast'
import { cn } from '@/lib/cn'
import { formatBRL } from '@/lib/format'
import { accountsApi } from '@/services/finance'
import { ACCOUNT_TYPE_LABEL, type AccountInput, type FinancialAccount } from '@/types/finance'
import { keys, useAccounts } from '../finance/queries'
import { AccountForm } from './AccountForm'

export function AccountsPage() {
  const q = useAccounts()
  const qc = useQueryClient()
  const toast = useToast()
  const [showArchived, setShowArchived] = useState(false)
  const [editing, setEditing] = useState<FinancialAccount | 'new' | null>(null)

  const archive = useMutation({
    mutationFn: ({ id, is_archived }: { id: number; is_archived: boolean }) => accountsApi.update(id, { is_archived }),
    onSuccess: (a) => {
      void qc.invalidateQueries({ queryKey: keys.accounts })
      toast.success(a.is_archived ? 'Conta arquivada.' : 'Conta restaurada.')
    },
  })

  const save = async (input: AccountInput) => {
    if (editing && editing !== 'new') await accountsApi.update(editing.id, input)
    else await accountsApi.create(input)
    await qc.invalidateQueries({ queryKey: keys.accounts })
    toast.success(editing === 'new' ? 'Conta criada.' : 'Conta atualizada.')
    setEditing(null)
  }

  const all = q.data ?? []
  const items = all.filter((a) => showArchived || !a.is_archived)
  const total = all.filter((a) => !a.is_archived).reduce((sum, a) => sum + Number(a.current_balance), 0) // só exibição

  return (
    <section>
      <PageHeader
        title="Contas"
        subtitle="Suas contas, carteiras e reservas. O saldo considera apenas movimentações realizadas."
        action={
          <Button onClick={() => setEditing('new')}>
            <Plus aria-hidden className="size-4" /> Nova conta
          </Button>
        }
      />

      {q.isPending ? (
        <LoadingBlock />
      ) : q.isError ? (
        <ErrorBlock message="Não foi possível carregar as contas." onRetry={() => void q.refetch()} />
      ) : (
        <>
          <Card className="mb-6">
            <p className="text-sm text-cinza-t">Saldo disponível</p>
            <p className="mt-1 text-3xl font-semibold">{formatBRL(total)}</p>
            <p className="mt-1 text-xs text-cinza-t">Soma do saldo atual das contas ativas.</p>
          </Card>

          <div className="mb-4 flex justify-end">
            <label className="flex items-center gap-2 text-sm text-cinza-t">
              <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} className="size-4 accent-suave" />
              Mostrar arquivadas
            </label>
          </div>

          {items.length === 0 ? (
            <EmptyState
              icon={Wallet}
              title="Nenhuma conta cadastrada"
              description="Cadastre sua conta corrente, carteira ou reserva para começar a registrar movimentações."
              action={<Button onClick={() => setEditing('new')}>Nova conta</Button>}
            />
          ) : (
            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {items.map((a) => {
                const negative = Number(a.current_balance) < 0
                return (
                  <li key={a.id}>
                    <Card className={cn('flex h-full flex-col gap-4', a.is_archived && 'opacity-70')}>
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex min-w-0 items-center gap-2">
                          <span aria-hidden className="size-3 shrink-0 rounded-full" style={{ background: a.color }} />
                          <h2 className="truncate font-medium">{a.name}</h2>
                        </div>
                        {a.is_archived && <Badge>Arquivada</Badge>}
                      </div>
                      <div>
                        <p className="text-xs text-cinza-t">{ACCOUNT_TYPE_LABEL[a.type]}</p>
                        <p className={cn('mt-1 text-2xl font-semibold', negative && 'text-queimado-t')}>
                          {formatBRL(a.current_balance)}
                        </p>
                        {negative && <p className="mt-0.5 text-xs text-queimado-t">Saldo negativo</p>}
                      </div>
                      <div className="mt-auto flex justify-end gap-1">
                        <Button variant="ghost" className="px-2" aria-label={`Editar ${a.name}`} onClick={() => setEditing(a)}>
                          <Pencil aria-hidden className="size-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          className="px-2"
                          aria-label={a.is_archived ? `Restaurar ${a.name}` : `Arquivar ${a.name}`}
                          disabled={archive.isPending}
                          onClick={() => archive.mutate({ id: a.id, is_archived: !a.is_archived })}
                        >
                          {a.is_archived ? <ArchiveRestore aria-hidden className="size-4" /> : <Archive aria-hidden className="size-4" />}
                        </Button>
                      </div>
                    </Card>
                  </li>
                )
              })}
            </ul>
          )}
        </>
      )}

      <Modal open={editing !== null} title={editing === 'new' ? 'Nova conta' : 'Editar conta'} onClose={() => setEditing(null)}>
        <AccountForm account={editing && editing !== 'new' ? editing : undefined} onSubmit={save} onCancel={() => setEditing(null)} />
      </Modal>
    </section>
  )
}
