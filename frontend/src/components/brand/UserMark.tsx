import { useId } from 'react'
import { cn } from '@/lib/cn'

/**
 * Ícone de usuário do NEXO: um busto na fita verde do logo, com a faixa diagonal escura cruzando os ombros —
 * a mesma "dobra" do N. As cores vêm de variáveis do tema (--user-mark-*), para ler bem de dia e à noite.
 */
export function UserMark({ className }: { className?: string }) {
  const id = useId()
  return (
    <svg viewBox="0 0 40 40" aria-hidden className={cn('size-full', className)} overflow="hidden">
      <defs>
        <linearGradient id={`${id}-fita`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" style={{ stopColor: 'var(--user-mark-1)' }} />
          <stop offset="1" style={{ stopColor: 'var(--user-mark-2)' }} />
        </linearGradient>
        <linearGradient id={`${id}-dobra`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" style={{ stopColor: 'var(--user-mark-3)' }} />
          <stop offset="1" style={{ stopColor: 'var(--user-mark-4)' }} />
        </linearGradient>
        <clipPath id={`${id}-busto`}>
          <path d="M6.5 42c0-8.6 6-14.4 13.5-14.4S33.5 33.4 33.5 42z" />
        </clipPath>
      </defs>
      <circle cx="20" cy="15.5" r="7.2" fill={`url(#${id}-fita)`} />
      <path d="M6.5 42c0-8.6 6-14.4 13.5-14.4S33.5 33.4 33.5 42z" fill={`url(#${id}-fita)`} />
      <path d="M9 26h6.4l17 17h-6.4z" fill={`url(#${id}-dobra)`} clipPath={`url(#${id}-busto)`} />
    </svg>
  )
}
