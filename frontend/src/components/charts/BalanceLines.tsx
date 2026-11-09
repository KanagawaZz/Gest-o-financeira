import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { CHART, compactBRL, monthLong, monthShort } from '@/lib/chart'
import { MoneyTooltip } from './MoneyTooltip'

export type LineSeries = { key: string; label: string; color: string; dashed?: boolean }
export type LineRow = { month: string; [key: string]: number | string }

/** Linhas de saldo por mês: 2px, marcadores de 8px, cursor vertical no hover e linha do zero quando há saldo negativo. */
export function BalanceLines({ data, series, height = 260 }: { data: LineRow[]; series: LineSeries[]; height?: number }) {
  const rows: Array<LineRow & { label: string }> = data.map((d) => ({ ...d, label: monthShort(d.month, true) }))
  const hasNegative = rows.some((r) => series.some((s) => Number(r[s.key]) < 0))
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={rows} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
        <CartesianGrid vertical={false} stroke={CHART.grid} />
        <XAxis dataKey="label" tickLine={false} axisLine={{ stroke: CHART.grid }} tick={{ fill: CHART.axis, fontSize: 12 }} />
        <YAxis tickLine={false} axisLine={false} width={84} tickFormatter={compactBRL} tick={{ fill: CHART.axis, fontSize: 12 }} />
        {hasNegative && <ReferenceLine y={0} stroke={CHART.axis} strokeOpacity={0.6} />}
        <Tooltip
          cursor={{ stroke: CHART.axis, strokeOpacity: 0.5 }}
          content={<MoneyTooltip labelFormatter={(l) => monthLong(rows.find((r) => r.label === l)?.month ?? l)} />}
        />
        {series.map((s) => (
          <Line
            key={s.key}
            type="monotone"
            dataKey={s.key}
            name={s.label}
            stroke={s.color}
            strokeWidth={2}
            strokeDasharray={s.dashed ? '5 4' : undefined}
            dot={{ r: 4, fill: s.color, stroke: CHART.surface, strokeWidth: 2 }}
            activeDot={{ r: 6, fill: s.color, stroke: CHART.surface, strokeWidth: 2 }}
            isAnimationActive={false}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  )
}
