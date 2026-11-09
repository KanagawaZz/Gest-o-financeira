import { CHART } from '@/lib/chart'
import { formatBRL } from '@/lib/format'

type Entry = { name?: string | number; value?: number | string; color?: string; dataKey?: string | number }

/** Dica de hover: rótulo do eixo + uma linha por série, com o valor em texto (não depende da cor). */
export function MoneyTooltip({
  active,
  payload,
  label,
  labelFormatter,
}: {
  active?: boolean
  payload?: readonly Entry[]
  label?: string | number
  labelFormatter?: (label: string) => string
}) {
  if (!active || !payload?.length) return null
  const title = label !== undefined ? (labelFormatter ? labelFormatter(String(label)) : String(label)) : undefined
  return (
    <div
      className="rounded-lg border border-white/12 px-3 py-2 text-xs shadow-lg"
      style={{ background: CHART.tooltipSurface, color: CHART.text }}
    >
      {title && <p className="mb-1 font-medium first-letter:uppercase">{title}</p>}
      <ul className="flex flex-col gap-0.5">
        {payload.map((p) => (
          <li key={String(p.dataKey ?? p.name)} className="flex items-center justify-between gap-4">
            <span className="flex items-center gap-1.5">
              <span aria-hidden className="inline-block h-2.5 w-2.5 rounded-[3px]" style={{ background: p.color }} />
              <span style={{ color: CHART.axis }}>{p.name}</span>
            </span>
            <span className="tabular-nums">{formatBRL(Number(p.value ?? 0))}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
