import { cn } from '@/lib/cn'

/** Filtros em pílula (mesmo visual das abas): contêiner + item ativo/inativo. */
export const pillGroup = 'inline-flex max-w-full gap-2 overflow-x-auto p-0.5'
export const pillItem = (active: boolean) =>
  cn(
    'min-h-10 shrink-0 rounded-full px-4 text-[15px] transition-colors',
    active
      ? 'bg-suave font-semibold text-on-acao shadow-[0_6px_20px_-8px_var(--acao-glow)]'
      : 'chip text-branco/90',
  )

/** Seletor compacto dentro de formulários (tipo de lançamento, forma de pagamento). */
export const segmentBox = 'grid gap-1 rounded-xl border border-linha/10 bg-marinho/70 p-1'
export const segmentItem = (active: boolean) =>
  cn('min-h-10 rounded-lg px-2 text-sm transition-colors', active ? 'bg-suave font-semibold text-on-acao' : 'text-cinza-t hover:bg-linha/6 hover:text-branco')
