import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

type Tone = 'neutral' | 'positive' | 'warning' | 'danger'

const tones: Record<Tone, string> = {
  neutral: 'bg-white/8 text-cinza-t',
  positive: 'bg-salvia/15 text-salvia-t',
  warning: 'bg-ambar/15 text-ambar-t',
  danger: 'bg-queimado/15 text-queimado-t',
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
