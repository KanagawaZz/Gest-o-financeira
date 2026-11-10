import { cn } from '@/lib/cn'
import { formatBRL } from '@/lib/format'
import { useCountUp } from '@/lib/useCountUp'

/** Valor em reais (string decimal da API ou número), animado em centavos. `null` vira "—". */
export function AnimatedMoney({ value, className }: { value: string | number | null | undefined; className?: string }) {
  const cents = value === null || value === undefined || value === '' ? null : Math.round(Number(value) * 100)
  const shown = useCountUp(cents)
  return <span className={cn('tabular-nums', className)}>{shown === null ? '—' : formatBRL(shown / 100)}</span>
}

/** Percentual com uma casa decimal (ex.: 141,8%), animado em décimos. */
export function AnimatedPercent({ value, className }: { value: number | null; className?: string }) {
  const tenths = value === null ? null : Math.round(value * 10)
  const shown = useCountUp(tenths)
  return (
    <span className={cn('tabular-nums', className)}>
      {shown === null ? '—' : `${(shown / 10).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`}
    </span>
  )
}
