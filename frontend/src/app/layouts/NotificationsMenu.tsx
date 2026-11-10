import { useQuery } from '@tanstack/react-query'
import { Bell, ChevronRight } from 'lucide-react'
import { useCallback, useId, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Badge } from '@/components/ui/Badge'
import { DUE_STATUS, currentYM, summaryKey } from '@/features/dashboard/due'
import { cn } from '@/lib/cn'
import { formatBRL, formatDate } from '@/lib/format'
import { useDismiss } from '@/lib/useDismiss'
import { dashboardApi } from '@/services/planning'

/** Sino com o que pede ação: vencimentos atrasados e os que vencem nos próximos 7 dias. */
export function NotificationsMenu() {
  const month = currentYM()
  const q = useQuery({ queryKey: summaryKey(month), queryFn: () => dashboardApi.summary(month), staleTime: 60_000 })
  const items = (q.data?.upcoming ?? []).filter((u) => u.status === 'overdue' || u.status === 'due_soon')
  const [open, setOpen] = useState(false)
  const wrap = useRef<HTMLDivElement>(null)
  const button = useRef<HTMLButtonElement>(null)
  const panelId = useId()
  const close = useCallback(() => setOpen(false), [])
  useDismiss(open, wrap, close, button)

  const label = items.length ? `Notificações: ${items.length} ${items.length === 1 ? 'pendente' : 'pendentes'}` : 'Notificações: nenhuma pendente'

  return (
    <div ref={wrap} className="relative">
      <button
        ref={button}
        type="button"
        aria-label={label}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((v) => !v)}
        className="relative flex size-11 items-center justify-center rounded-full text-branco/90 transition-colors hover:bg-linha/8"
      >
        <Bell aria-hidden className="size-6" />
        {items.length > 0 && (
          <span aria-hidden className="absolute right-1 top-1 flex min-w-5 items-center justify-center rounded-full bg-queimado px-1 text-[11px] font-bold leading-5 text-white ring-2 ring-marinho">
            {items.length > 9 ? '9+' : items.length}
          </span>
        )}
      </button>
      {open && (
        <div id={panelId} role="region" aria-label="Notificações" className="surface-strong absolute right-0 z-40 mt-2 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-2xl">
          <p className="border-b border-linha/8 px-4 py-3 text-sm font-semibold">Notificações</p>
          {q.isPending ? (
            <p className="px-4 py-6 text-center text-sm text-cinza-t">Carregando…</p>
          ) : q.isError ? (
            <p role="alert" className="px-4 py-6 text-center text-sm text-queimado-t">Não foi possível carregar os vencimentos.</p>
          ) : items.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-cinza-t">Nada atrasado nem vencendo nos próximos 7 dias.</p>
          ) : (
            <ul className="max-h-80 divide-y divide-linha/6 overflow-y-auto">
              {items.map((u) => {
                const st = DUE_STATUS[u.status]
                return (
                  <li key={`${u.source}-${u.id}-${u.due_date}`} className="flex items-center gap-3 px-4 py-3">
                    <span aria-hidden className={cn('size-2 shrink-0 rounded-full', u.status === 'overdue' ? 'bg-queimado' : 'bg-ambar')} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{u.description}</p>
                      <p className="text-xs text-cinza-t">{formatDate(u.due_date)}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <p className="text-sm font-semibold tabular-nums">{formatBRL(u.amount)}</p>
                      <Badge tone={st.tone}>{u.kind === 'income' ? 'A receber' : st.label(u.days_left)}</Badge>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
          <Link to="/contas" onClick={() => setOpen(false)} className="flex items-center justify-between border-t border-linha/8 px-4 py-3 text-sm text-suave-t hover:bg-linha/5">
            Ver compromissos <ChevronRight aria-hidden className="size-4" />
          </Link>
        </div>
      )}
    </div>
  )
}
