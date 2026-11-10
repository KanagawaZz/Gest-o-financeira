import { barHeights, monthShort } from '@/lib/chart'
import { cn } from '@/lib/cn'
import { formatBRL } from '@/lib/format'
import type { TrendPoint } from '@/types/planning'

/**
 * Mini-gráfico de barras com dados reais (6 meses). A cor vem do token do indicador (classe `bg-*`);
 * o leitor de tela recebe os valores por extenso.
 */
export function TrendBars({ points, colorClass, caption, className }: { points: TrendPoint[]; colorClass: string; caption: string; className?: string }) {
  const values = points.map((p) => Number(p.value))
  const heights = barHeights(values)
  const label = `${caption}: ${points.map((p) => `${monthShort(p.month)} ${formatBRL(p.value)}`).join(', ')}`
  return (
    <div role="img" aria-label={label} title={label} className={cn('flex h-10 items-end gap-1', className)}>
      {heights.map((h, i) => (
        <span
          key={points[i]?.month ?? i}
          className={cn('w-1.5 rounded-sm', colorClass, values[i]! < 0 && 'opacity-60')}
          style={{ height: `${h}%`, opacity: values[i]! < 0 ? undefined : 0.45 + (0.55 * (i + 1)) / heights.length }}
        />
      ))}
    </div>
  )
}
