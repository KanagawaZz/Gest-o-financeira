import { useId } from 'react'
import { cn } from '@/lib/cn'

export type TabItem<T extends string> = { value: T; label: string }

/** Abas com semântica de tablist (setas do teclado navegam entre elas). */
export function Tabs<T extends string>({
  items,
  value,
  onChange,
  label,
}: {
  items: TabItem<T>[]
  value: T
  onChange: (v: T) => void
  label: string
}) {
  const id = useId()
  function onKey(e: React.KeyboardEvent, index: number) {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return
    e.preventDefault()
    const next = items[(index + (e.key === 'ArrowRight' ? 1 : -1) + items.length) % items.length]
    if (next) {
      onChange(next.value)
      document.getElementById(`${id}-${next.value}`)?.focus()
    }
  }
  return (
    <div role="tablist" aria-label={label} className="inline-flex max-w-full gap-2 overflow-x-auto p-0.5">
      {items.map((it, i) => (
        <button
          key={it.value}
          id={`${id}-${it.value}`}
          role="tab"
          aria-selected={value === it.value}
          tabIndex={value === it.value ? 0 : -1}
          onClick={() => onChange(it.value)}
          onKeyDown={(e) => onKey(e, i)}
          className={cn(
            'min-h-10 shrink-0 rounded-full px-5 text-[15px] transition-colors',
            value === it.value
              ? 'bg-suave font-semibold text-on-acao shadow-[0_6px_20px_-8px_var(--acao-glow)]'
              : 'chip text-branco/90',
          )}
        >
          {it.label}
        </button>
      ))}
    </div>
  )
}
