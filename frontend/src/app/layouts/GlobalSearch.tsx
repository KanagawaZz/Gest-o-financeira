import { useQuery } from '@tanstack/react-query'
import { CornerDownLeft, Search } from 'lucide-react'
import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { NAV_ITEMS } from '@/app/navigation'
import { cn } from '@/lib/cn'
import { formatBRL, formatDate } from '@/lib/format'
import { useDismiss } from '@/lib/useDismiss'
import { transactionsApi } from '@/services/finance'

/** Palavras que levam a cada tela além do próprio nome (sem acento, minúsculas). */
const KEYWORDS: Record<string, string[]> = {
  '/': ['painel', 'resumo', 'projecao', 'simulador', 'saldo', 'inicio'],
  '/contas': ['conta', 'banco', 'carteira', 'compromisso', 'recorrente', 'vencimento', 'boleto'],
  '/transacoes': ['receita', 'despesa', 'transferencia', 'lancamento', 'movimentacao', 'estorno'],
  '/parcelamentos': ['parcela', 'parcelado', 'quitar', 'quitacao'],
  '/cartoes': ['cartao', 'fatura', 'limite', 'credito'],
  '/categorias': ['categoria'],
  '/metas': ['meta', 'reserva', 'objetivo', 'aporte', 'guardar'],
  '/relatorios': ['relatorio', 'csv', 'pdf', 'exportar', 'comparacao'],
  '/configuracoes': ['perfil', 'senha', 'seguranca', 'backup', 'exportacao', 'configuracao'],
}
const TX_LIMIT = 6

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()

type Option = { id: string; kind: 'page' | 'tx'; label: string; detail?: string; amount?: string; positive?: boolean; go: () => void }

export function GlobalSearch({ className, onNavigate, autoFocus }: { className?: string; onNavigate?: () => void; autoFocus?: boolean }) {
  const navigate = useNavigate()
  const listId = useId()
  const wrap = useRef<HTMLDivElement>(null)
  const input = useRef<HTMLInputElement>(null)
  const [q, setQ] = useState('')
  const [term, setTerm] = useState('')
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const close = useCallback(() => setOpen(false), [])
  useDismiss(open, wrap, close, input)

  // Espera a pessoa parar de digitar antes de consultar a API.
  useEffect(() => {
    const t = setTimeout(() => setTerm(q.trim()), 250)
    return () => clearTimeout(t)
  }, [q])

  const txQ = useQuery({
    queryKey: ['transactions', 'global-search', term],
    queryFn: () => transactionsApi.list({ search: term }, 1, TX_LIMIT),
    enabled: term.length >= 2,
    staleTime: 30_000,
  })

  const nq = norm(q)
  const finish = (path: string) => {
    setOpen(false)
    setQ('')
    onNavigate?.()
    navigate(path)
  }
  const pages: Option[] = nq
    ? NAV_ITEMS.filter((n) => norm(n.label).includes(nq) || (KEYWORDS[n.to] ?? []).some((k) => k.includes(nq) || nq.includes(k))).map((n) => ({
        id: `p${n.to}`,
        kind: 'page',
        label: n.label,
        detail: 'Abrir tela',
        go: () => finish(n.to),
      }))
    : []
  const txs: Option[] =
    term.length >= 2 && txQ.data
      ? txQ.data.results.map((t) => ({
          id: `t${t.id}`,
          kind: 'tx',
          label: t.description,
          detail: [formatDate(t.date), t.category_name].filter(Boolean).join(' · '),
          amount: formatBRL(t.amount),
          positive: t.type === 'income',
          go: () => finish(`/transacoes?busca=${encodeURIComponent(term)}&mes=${t.date.slice(0, 7)}`),
        }))
      : []
  const options = [...pages, ...txs]
  const current = Math.min(active, Math.max(0, options.length - 1))
  const showPanel = open && nq.length > 0
  const searching = term.length >= 2 && txQ.isFetching

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      setOpen(true)
      if (options.length) setActive((current + (e.key === 'ArrowDown' ? 1 : -1) + options.length) % options.length)
    } else if (e.key === 'Enter') {
      e.preventDefault()
      options[current]?.go()
    }
  }

  return (
    <div ref={wrap} className={cn('relative', className)}>
      {/* z-10: o campo usa backdrop-filter (nova camada) e cobriria o ícone. */}
      <Search aria-hidden className="pointer-events-none absolute left-4 top-1/2 z-10 size-5 -translate-y-1/2 text-cinza-t" />
      <input
        ref={input}
        type="search"
        role="combobox"
        aria-label="Buscar no sistema"
        aria-expanded={showPanel}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={showPanel && options[current] ? `${listId}-${options[current].id}` : undefined}
        placeholder="Buscar no sistema..."
        autoFocus={autoFocus}
        value={q}
        onChange={(e) => {
          setQ(e.target.value)
          setActive(0)
          setOpen(true)
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
        className="min-h-12 w-full surface rounded-full pl-12 pr-4 text-[15px] text-branco placeholder:text-cinza-t focus:border-suave/60 focus:outline-none [&::-webkit-search-cancel-button]:hidden"
      />
      {showPanel && (
        <div className="surface-strong absolute inset-x-0 top-[calc(100%+8px)] z-40 overflow-hidden rounded-2xl">
          <ul id={listId} role="listbox" aria-label="Resultados da busca" className="max-h-96 overflow-y-auto p-1.5">
            {pages.length > 0 && <li role="presentation" className="px-3 pb-1 pt-2 text-xs font-medium uppercase tracking-wide text-cinza-t">Telas</li>}
            {pages.map((o) => (
              <OptionRow key={o.id} o={o} id={`${listId}-${o.id}`} selected={options[current]?.id === o.id} onHover={() => setActive(options.indexOf(o))} />
            ))}
            {txs.length > 0 && <li role="presentation" className="px-3 pb-1 pt-3 text-xs font-medium uppercase tracking-wide text-cinza-t">Lançamentos</li>}
            {txs.map((o) => (
              <OptionRow key={o.id} o={o} id={`${listId}-${o.id}`} selected={options[current]?.id === o.id} onHover={() => setActive(options.indexOf(o))} />
            ))}
          </ul>
          <p role="status" className="border-t border-linha/8 px-4 py-2.5 text-xs text-cinza-t">
            {searching
              ? 'Buscando lançamentos…'
              : options.length === 0
                ? nq.length < 2
                  ? 'Digite ao menos 2 letras para buscar lançamentos.'
                  : `Nada encontrado para “${q.trim()}”.`
                : txQ.data && txQ.data.count > TX_LIMIT
                  ? `Mostrando os ${TX_LIMIT} lançamentos mais recentes de ${txQ.data.count}.`
                  : `${options.length} resultado(s). Enter abre o destacado.`}
          </p>
        </div>
      )}
    </div>
  )
}

function OptionRow({ o, id, selected, onHover }: { o: Option; id: string; selected: boolean; onHover: () => void }) {
  return (
    <li
      id={id}
      role="option"
      aria-selected={selected}
      onMouseDown={(e) => e.preventDefault()}
      onClick={o.go}
      onMouseMove={onHover}
      className={cn('flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5', selected && 'bg-linha/8')}
    >
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{o.label}</p>
        {o.detail && <p className="truncate text-xs text-cinza-t">{o.detail}</p>}
      </div>
      {o.amount && <p className={cn('shrink-0 text-sm font-semibold tabular-nums', o.positive && 'text-salvia-t')}>{o.amount}</p>}
      {selected && <CornerDownLeft aria-hidden className="size-4 shrink-0 text-cinza-t" />}
    </li>
  )
}
