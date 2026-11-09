import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { CHART, compactBRL, monthLong, monthShort } from '@/lib/chart'
import { MoneyTooltip } from './MoneyTooltip'

export type MonthlyDatum = { month: string; income: number; expense: number }

/** Barras agrupadas receitas × despesas por mês: base reta, ponta de 4px, 2px entre barras. */
export function MonthlyBars({ data, height = 260 }: { data: MonthlyDatum[]; height?: number }) {
  const rows = data.map((d) => ({ ...d, label: monthShort(d.month) }))
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={rows} barGap={2} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
        <CartesianGrid vertical={false} stroke={CHART.grid} />
        <XAxis dataKey="label" tickLine={false} axisLine={{ stroke: CHART.grid }} tick={{ fill: CHART.axis, fontSize: 12 }} />
        <YAxis tickLine={false} axisLine={false} width={78} tickFormatter={compactBRL} tick={{ fill: CHART.axis, fontSize: 12 }} />
        <Tooltip
          cursor={{ fill: 'rgba(241,244,248,0.06)' }}
          content={<MoneyTooltip labelFormatter={(l) => monthLong(rows.find((r) => r.label === l)?.month ?? l)} />}
        />
        <Bar dataKey="income" name="Receitas" fill={CHART.income} radius={[4, 4, 0, 0]} maxBarSize={18} isAnimationActive={false} />
        <Bar dataKey="expense" name="Despesas" fill={CHART.expense} radius={[4, 4, 0, 0]} maxBarSize={18} isAnimationActive={false} />
      </BarChart>
    </ResponsiveContainer>
  )
}
