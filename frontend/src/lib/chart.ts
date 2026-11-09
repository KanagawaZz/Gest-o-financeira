/**
 * Tokens de gráfico. Os hex abaixo passaram em validate_palette.js (modo escuro, superfície #263b55):
 *  - receita/despesa: lightness, croma, CVD (ΔE 18,3), visão normal (ΔE 22,5) e contraste ≥ 3:1.
 *  - categorias (6, nesta ordem fixa): todos os critérios passam; "Outros" é cinza neutro.
 * O app é escuro por definição da paleta oficial; não existe tema claro validado.
 */
export const CHART = {
  income: '#5A96D2',
  expense: '#CF7752',
  neutral: '#8A99AD',
  categories: ['#5A96D2', '#CF7752', '#A07DD0', '#3FA77E', '#B88D20', '#CC6B96'],
  grid: 'rgba(241, 244, 248, 0.08)',
  axis: '#B0BCCB', // = cinza-t (texto)
  text: '#F1F4F8',
  surface: '#263B55',
  tooltipSurface: '#111C2C',
} as const

const MONTHS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

/** "2026-11" -> "Nov" (ou "Nov/26" com ano). */
export function monthShort(ym: string, withYear = false): string {
  const [y, m] = ym.split('-')
  const label = MONTHS[Number(m) - 1] ?? ym
  return withYear ? `${label}/${(y ?? '').slice(2)}` : label
}

export function monthLong(ym: string): string {
  const [y, m] = ym.split('-')
  return new Date(Number(y), Number(m) - 1, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
}

/** Eixo: R$ 1,2 mil / R$ 3 mi. Apenas apresentação. */
export function compactBRL(value: number): string {
  const abs = Math.abs(value)
  const sign = value < 0 ? '−' : ''
  if (abs >= 1_000_000) return `${sign}R$ ${(abs / 1_000_000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mi`
  if (abs >= 1_000) return `${sign}R$ ${(abs / 1_000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mil`
  return `${sign}R$ ${abs.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}`
}

export type CategoryDatum = { category_id?: number | null; name: string; amount: string; percent: number }
export type SlicedCategory = { name: string; value: number; percent: number; color: string }

/**
 * Até 6 categorias com cor fixa; o resto vira "Outros" (cinza). A cor segue a entidade:
 * a fatia mantém seu slot pela ordem do id da categoria, e não pelo ranking do mês.
 */
export function sliceCategories(items: CategoryDatum[], max = 6): SlicedCategory[] {
  const ranked = [...items].sort((a, b) => Number(b.amount) - Number(a.amount))
  const kept = ranked.slice(0, max)
  const rest = ranked.slice(max)
  const bySlot = [...kept].sort((a, b) => (a.category_id ?? 0) - (b.category_id ?? 0))
  const color = new Map(bySlot.map((c, i) => [c.name, CHART.categories[i] ?? CHART.neutral]))
  const out: SlicedCategory[] = kept.map((c) => ({ name: c.name, value: Number(c.amount), percent: c.percent, color: color.get(c.name) ?? CHART.neutral }))
  if (rest.length) {
    out.push({
      name: 'Outros',
      value: rest.reduce((s, c) => s + Number(c.amount), 0),
      percent: Math.round(rest.reduce((s, c) => s + c.percent, 0) * 10) / 10,
      color: CHART.neutral,
    })
  }
  return out
}
