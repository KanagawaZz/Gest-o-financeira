import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
import { useChart, sliceCategories, type CategoryDatum } from '@/lib/chart'
import { formatBRL } from '@/lib/format'
import { MoneyTooltip } from './MoneyTooltip'
import { MOTION, useReducedMotion } from '@/lib/motion'
import { useChartVisible } from './visibility'

/** Rosca de despesas por categoria + lista com nome, % e valor (a identidade não depende da cor). */
export function CategoryDonut({ items, total }: { items: CategoryDatum[]; total: string }) {
  const chart = useChart()
  const reduced = useReducedMotion()
  const visible = useChartVisible() // séries só montam (e animam) quando o gráfico aparece
  const slices = sliceCategories(items, 6, chart)
  return (
    <div className="flex flex-col items-center gap-5 sm:flex-row">
      <div className="relative size-44 shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            {visible && (
            <Pie isAnimationActive={!reduced} animationDuration={MOTION.data} animationEasing="ease-out"
              startAngle={90}
              endAngle={-270}
              data={slices}
              dataKey="value"
              nameKey="name"
              innerRadius={58}
              outerRadius={84}
              paddingAngle={2}
              stroke={chart.surface}
              strokeWidth={2}
             
            >
              {slices.map((s) => (
                <Cell key={s.name} fill={s.color} />
              ))}
            </Pie>
            )}
            <Tooltip content={<MoneyTooltip />} />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className="text-[11px] text-cinza-t">Total</span>
          <span className="text-sm font-semibold tabular-nums">{formatBRL(total)}</span>
        </div>
      </div>
      <ul className="w-full min-w-0 flex-1 space-y-1.5 text-sm">
        {slices.map((s) => (
          <li key={s.name} className="flex items-center gap-2">
            <span aria-hidden className="inline-block h-2.5 w-2.5 shrink-0 rounded-[3px]" style={{ background: s.color }} />
            <span className="min-w-0 flex-1 truncate">{s.name}</span>
            <span className="tabular-nums text-cinza-t">{s.percent.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%</span>
            <span className="w-24 text-right tabular-nums">{formatBRL(s.value)}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
