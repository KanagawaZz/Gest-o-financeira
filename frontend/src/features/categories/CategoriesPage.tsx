import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Archive, ArchiveRestore, Pencil, Plus, Tags } from 'lucide-react'
import { useState } from 'react'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { Modal } from '@/components/ui/Modal'
import { PageHeader } from '@/components/ui/PageHeader'
import { pillGroup, pillItem } from '@/components/ui/segmented'
import { ErrorBlock, LoadingBlock } from '@/components/ui/QueryState'
import { useToast } from '@/components/ui/Toast'
import { cn } from '@/lib/cn'
import { categoriesApi } from '@/services/finance'
import type { Category, CategoryKind } from '@/types/finance'
import { keys, useCategories } from '../finance/queries'
import { CategoryForm } from './CategoryForm'

export function CategoriesPage() {
  const q = useCategories()
  const qc = useQueryClient()
  const toast = useToast()
  const [kind, setKind] = useState<CategoryKind>('expense')
  const [showArchived, setShowArchived] = useState(false)
  const [editing, setEditing] = useState<Category | 'new' | null>(null)

  const archive = useMutation({
    mutationFn: ({ id, is_archived }: { id: number; is_archived: boolean }) => categoriesApi.update(id, { is_archived }),
    onSuccess: (c) => {
      void qc.invalidateQueries({ queryKey: keys.categories })
      toast.success(c.is_archived ? 'Categoria arquivada.' : 'Categoria restaurada.')
    },
  })

  const save = async (input: Parameters<typeof categoriesApi.create>[0]) => {
    if (editing && editing !== 'new') await categoriesApi.update(editing.id, { name: input.name, color: input.color })
    else await categoriesApi.create(input)
    await qc.invalidateQueries({ queryKey: keys.categories })
    toast.success(editing === 'new' ? 'Categoria criada.' : 'Categoria atualizada.')
    setEditing(null)
  }

  const items = (q.data ?? []).filter((c) => c.kind === kind && (showArchived || !c.is_archived))

  return (
    <section>
      <PageHeader
        title="Categorias"
        subtitle="Organize receitas e despesas. Categorias com histórico são arquivadas, nunca excluídas."
        action={
          <Button onClick={() => setEditing('new')}>
            <Plus aria-hidden className="size-4" /> Nova categoria
          </Button>
        }
      />

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div role="tablist" aria-label="Tipo de categoria" className={pillGroup}>
          {(['expense', 'income'] as const).map((k) => (
            <button
              key={k}
              role="tab"
              aria-selected={kind === k}
              onClick={() => setKind(k)}
              className={pillItem(kind === k)}
            >
              {k === 'expense' ? 'Despesas' : 'Receitas'}
            </button>
          ))}
        </div>
        <label className="flex items-center gap-2 text-sm text-cinza-t">
          <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} className="size-4 accent-suave" />
          Mostrar arquivadas
        </label>
      </div>

      {q.isPending ? (
        <LoadingBlock />
      ) : q.isError ? (
        <ErrorBlock message="Não foi possível carregar as categorias." onRetry={() => void q.refetch()} />
      ) : items.length === 0 ? (
        <EmptyState
          icon={Tags}
          title="Nenhuma categoria aqui"
          description="Crie uma categoria para classificar suas movimentações."
          action={<Button onClick={() => setEditing('new')}>Nova categoria</Button>}
        />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((c) => (
            <li key={c.id}>
              <Card className={cn('flex items-center gap-3 p-4', c.is_archived && 'opacity-70')}>
                <span aria-hidden className="size-4 shrink-0 rounded-full" style={{ background: c.color }} />
                <span className="min-w-0 flex-1 truncate text-sm font-medium">{c.name}</span>
                {c.is_archived && <Badge>Arquivada</Badge>}
                <Button variant="ghost" className="px-2" aria-label={`Editar ${c.name}`} onClick={() => setEditing(c)}>
                  <Pencil aria-hidden className="size-4" />
                </Button>
                <Button
                  variant="ghost"
                  className="px-2"
                  aria-label={c.is_archived ? `Restaurar ${c.name}` : `Arquivar ${c.name}`}
                  disabled={archive.isPending}
                  onClick={() => archive.mutate({ id: c.id, is_archived: !c.is_archived })}
                >
                  {c.is_archived ? <ArchiveRestore aria-hidden className="size-4" /> : <Archive aria-hidden className="size-4" />}
                </Button>
              </Card>
            </li>
          ))}
        </ul>
      )}
      {archive.isError && (
        <p role="alert" className="mt-3 text-sm text-queimado-t">
          Não foi possível alterar a categoria.
        </p>
      )}

      <Modal open={editing !== null} title={editing === 'new' ? 'Nova categoria' : 'Editar categoria'} onClose={() => setEditing(null)}>
        <CategoryForm
          category={editing && editing !== 'new' ? editing : undefined}
          defaultKind={kind}
          onSubmit={save}
          onCancel={() => setEditing(null)}
        />
      </Modal>
    </section>
  )
}
