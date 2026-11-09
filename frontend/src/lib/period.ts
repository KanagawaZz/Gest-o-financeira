export type PeriodKind = 'month' | 'quarter' | 'semester' | 'year' | 'custom'

const pad = (n: number) => String(n).padStart(2, '0')
const iso = (y: number, m: number, d: number) => `${y}-${pad(m)}-${pad(d)}`
const lastDay = (y: number, m: number) => new Date(y, m, 0).getDate()

export type PeriodAnchor = { year: number; month: number } // month 1-12 (referência dentro do período)

/** Intervalo [from, to] do período que contém a âncora. `custom` não passa por aqui. */
export function periodRange(kind: Exclude<PeriodKind, 'custom'>, a: PeriodAnchor): { from: string; to: string } {
  const size = { month: 1, quarter: 3, semester: 6, year: 12 }[kind]
  const startMonth = Math.floor((a.month - 1) / size) * size + 1
  const endMonth = startMonth + size - 1
  return { from: iso(a.year, startMonth, 1), to: iso(a.year, endMonth, lastDay(a.year, endMonth)) }
}

/** Move a âncora para o período anterior/seguinte do mesmo tamanho. */
export function shiftPeriod(kind: Exclude<PeriodKind, 'custom'>, a: PeriodAnchor, delta: number): PeriodAnchor {
  const size = { month: 1, quarter: 3, semester: 6, year: 12 }[kind]
  const total = a.year * 12 + (a.month - 1) + delta * size
  return { year: Math.floor(total / 12), month: (total % 12) + 1 }
}

export function periodLabel(kind: Exclude<PeriodKind, 'custom'>, a: PeriodAnchor): string {
  const r = periodRange(kind, a)
  const m = Number(r.from.slice(5, 7))
  if (kind === 'month') return new Date(a.year, a.month - 1, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
  if (kind === 'quarter') return `${Math.ceil(m / 3)}º trimestre de ${a.year}`
  if (kind === 'semester') return `${m <= 6 ? 1 : 2}º semestre de ${a.year}`
  return String(a.year)
}
