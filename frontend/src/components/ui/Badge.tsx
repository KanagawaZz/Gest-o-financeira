import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

type Tone = 'neutral' | 'positive' | 'warning' | 'danger'

const tones: Record<Tone, string> = {
  neutral: 'bg-linha/10 text-branco',
  positive: 'bg-salvia/15 text-salvia-t ring-1 ring-salvia/25',
  warning: 'bg-ambar/15 text-ambar-t ring-1 ring-ambar/25',
  danger: 'bg-queimado/15 text-queimado-t ring-1 ring-queimado/25',
}

/** O status é sempre comunicado por texto (e ícone opcional), nunca só por cor. */
export function Badge({ tone = 'neutral', icon, children }: { tone?: Tone; icon?: ReactNode; children: ReactNode }) {
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium', tones[tone])}>
      {icon}
      {children}
    </span>
  )
}
