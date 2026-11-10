import { useId } from 'react'
import { cn } from '@/lib/cn'

/**
 * Monograma "N" em fita (a diagonal mais escura dá a dobra). Decorativo: o nome vem em texto ao lado.
 * As cores vêm do tema (--logo-1..4): verde no tema cidade, azul no tema azul, branco sobre a barra azul.
 */
export function LogoMark({ className }: { className?: string }) {
  const id = useId()
  return (
    <svg viewBox="0 0 40 40" aria-hidden className={cn('size-10 shrink-0', className)}>
      <defs>
        <linearGradient id={`${id}-a`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" style={{ stopColor: 'var(--logo-1, #5ff2b6)' }} />
          <stop offset="1" style={{ stopColor: 'var(--logo-2, #14a873)' }} />
        </linearGradient>
        <linearGradient id={`${id}-b`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" style={{ stopColor: 'var(--logo-3, #0f8a5f)' }} />
          <stop offset="1" style={{ stopColor: 'var(--logo-4, #2fd497)' }} />
        </linearGradient>
      </defs>
      <path d="M5 35V5h8v30z" fill={`url(#${id}-a)`} />
      <path d="M27 35V5h8v30z" fill={`url(#${id}-a)`} />
      <path d="M5 5h8l22 30h-8z" fill={`url(#${id}-b)`} />
    </svg>
  )
}

export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <LogoMark className={compact ? 'size-8' : 'size-11'} />
      <div className="leading-none">
        <p className={cn('font-bold tracking-wide', compact ? 'text-xl' : 'text-[26px]')}>NEXO</p>
        <p className={cn('text-cinza-t', compact ? 'hidden text-xs sm:block' : 'mt-1 text-sm')}>Meu Financeiro</p>
      </div>
    </div>
  )
}
