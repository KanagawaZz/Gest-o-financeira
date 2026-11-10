import { BarChart3, Table2 } from 'lucide-react'
import { useId, useRef, useState, type ReactNode } from 'react'
import { Card } from '@/components/ui/Card'
import { ChartVisibleContext, useInViewOnce } from './visibility'

export type LegendItem = { label: string; color: string; dashed?: boolean }
export type TableData = { columns: string[]; rows: (string | number)[][] }

/**
 * Moldura padrão de gráfico: título, legenda (sempre, com ≥ 2 séries) e alternativa em tabela.
 * Identidade nunca depende só da cor: legenda com rótulo + tabela equivalente.
 */
export function ChartCard({
  title,
  subtitle,
  legend,
  table,
  summary,
  children,
  className,
}: {
  title: string
  subtitle?: string
  legend?: LegendItem[]
  table: TableData
  /** Resumo textual lido por leitores de tela no lugar do desenho. */
  summary: string
  children: ReactNode
  className?: string
}) {
  const [asTable, setAsTable] = useState(false)
  const chartRef = useRef<HTMLDivElement>(null)
  const visible = useInViewOnce(chartRef)
  const id = useId()
  return (
    <Card className={className}>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-medium">{title}</h2>
          {subtitle && <p className="mt-0.5 text-xs text-cinza-t">{subtitle}</p>}
        </div>
        <button
          type="button"
          onClick={() => setAsTable((v) => !v)}
          aria-pressed={asTable}
          aria-controls={id}
          className="inline-flex min-h-9 items-center gap-1.5 rounded-lg px-2.5 text-xs text-cinza-t hover:bg-linha/5 hover:text-branco"
        >
          {asTable ? <BarChart3 aria-hidden className="size-4" /> : <Table2 aria-hidden className="size-4" />}
          {asTable ? 'Ver gráfico' : 'Ver como tabela'}
        </button>
      </div>

      {legend && legend.length > 1 && (
        <ul className="mb-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-cinza-t" aria-label="Legenda">
          {legend.map((l) => (
            <li key={l.label} className="flex items-center gap-1.5">
              <span
                aria-hidden
                className="inline-block h-2.5 w-2.5 rounded-[3px]"
                style={{ background: l.dashed ? 'transparent' : l.color, border: l.dashed ? `2px dashed ${l.color}` : undefined }}
              />
              {l.label}
            </li>
          ))}
        </ul>
      )}

      <div id={id}>
        {asTable ? (
          <div className="overflow-x-auto" tabIndex={0} role="region" aria-label="Tabela (role para ver mais colunas)">
            <table className="w-full min-w-72 text-sm">
              <thead>
                <tr className="text-left text-xs text-cinza-t">
                  {table.columns.map((c, i) => (
                    <th key={c} scope="col" className={`px-2 py-2 font-medium ${i > 0 ? 'text-right' : ''}`}>
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {table.rows.map((r, ri) => (
                  <tr key={ri} className="border-t border-linha/8">
                    {r.map((cell, ci) => (
                      <td key={ci} className={`px-2 py-2 tabular-nums ${ci > 0 ? 'text-right' : ''}`}>
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div ref={chartRef} role="img" aria-label={summary}>
            <ChartVisibleContext.Provider value={visible}>{children}</ChartVisibleContext.Provider>
          </div>
        )}
      </div>
    </Card>
  )
}
