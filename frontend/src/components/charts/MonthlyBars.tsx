import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { useChart, compactBRL, monthLong, monthShort } from '@/lib/chart'
import { MoneyTooltip } from './MoneyTooltip'
import { MOTION, useReducedMotion } from '@/lib/motion'
import { useChartVisible } from './visibility'

export type MonthlyDatum = { month: string; income: number; expense: number }

/** Barras agrupadas receitas × despesas por mês: base reta, ponta de 4px, 2px entre barras. */
export function MonthlyBars({ data, height = 260 }: { data: MonthlyDatum[]; height?: number }) {
  const chart = useChart()
  const reduced = useReducedMotion()
  const visible = useChartVisible() // séries só montam (e animam) quando o gráfico aparece
  const rows = data.map((d) => ({ ...d, label: monthShort(d.month) }))
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={rows} barGap={2} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
        <CartesianGrid vertical={false} stroke={chart.grid} />
        <XAxis dataKey="label" tickLine={false} axisLine={{ stroke: chart.grid }} tick={{ fill: chart.axis, fontSize: 12 }} />
        <YAxis tickLine={false} axisLine={false} width={78} tickFormatter={compactBRL} tick={{ fill: chart.axis, fontSize: 12 }} />
        <Tooltip
          cursor={{ fill: 'rgba(241,244,248,0.06)' }}
          content={<MoneyTooltip labelFormatter={(l) => monthLong(rows.find((r) => r.label === l)?.month ?? l)} />}
        />
        {visible && (
          <>
          <Bar dataKey="income" isAnimationActive={!reduced} animationDuration={MOTION.data} animationEasing="ease-out" name="Receitas" fill={chart.income} radius={[4, 4, 0, 0]} maxBarSize={18} />
          <Bar dataKey="expense" isAnimationActive={!reduced} animationDuration={MOTION.data} animationEasing="ease-out" name="Despesas" fill={chart.expense} radius={[4, 4, 0, 0]} maxBarSize={18} />
          </>
        )}
      </BarChart>
    </ResponsiveContainer>
  )
}
