import { useTheme } from '@/app/providers/ThemeProvider'

/**
 * Tokens de gráfico, uma paleta por tema (validadas com validate_palette.js: luminosidade, croma,
 * daltonismo e contraste de receita/despesa e das 6 categorias):
 *  - cidade: os gráficos vivem em cards de VIDRO FUMÊ em todos os períodos, então a paleta é a escura
 *    (validada sobre #263b55 e #1c2638);
 *  - azul: cards cinza-claro (#f0f1f5), paleta clara com os mesmos matizes, um passo mais escuros.
 */
export type ChartPalette = {
  income: string
  expense: string
  neutral: string
  categories: readonly string[]
  grid: string
  axis: string
  text: string
  surface: string
  tooltipSurface: string
}

const CHART_DARK: ChartPalette = {
  income: '#5A96D2',
  expense: '#CF7752',
  neutral: '#8A99AD',
  categories: ['#5A96D2', '#CF7752', '#A07DD0', '#3FA77E', '#B88D20', '#CC6B96'],
  grid: 'rgba(241, 244, 248, 0.1)',
  axis: '#CED5DC', // = cinza-t (texto)
  text: '#F4F6F8',
  surface: '#111B23',
  tooltipSurface: '#0B1424',
}

const CHART_LIGHT: ChartPalette = {
  income: '#2F6FB7',
  expense: '#C2562B',
  neutral: '#6B7888',
  categories: ['#2F6FB7', '#C2562B', '#7D55C7', '#157F63', '#AD7F00', '#B8457A'],
  grid: 'rgba(17, 18, 20, 0.1)',
  axis: '#5B6270', // = cinza-t (texto)
  text: '#111214',
  surface: '#F0F1F5',
  tooltipSurface: '#FFFFFF',
}

/** Paleta dos gráficos do tema em uso. */
export function useChart(): ChartPalette {
  return useTheme().style === 'azul' ? CHART_LIGHT : CHART_DARK
}

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

/**
 * Altura de cada barra do mini-gráfico, em % (12–100). A escala vai de zero (ou do menor valor, se houver
 * negativos) até o maior valor; série toda zerada vira barras baixas.
 */
export function barHeights(values: number[]): number[] {
  if (!values.length) return []
  const min = Math.min(0, ...values)
  const max = Math.max(0, ...values)
  if (max === min) return values.map(() => 12)
  return values.map((v) => Math.round(12 + ((v - min) / (max - min)) * 88))
}

export type CategoryDatum = { category_id?: number | null; name: string; amount: string; percent: number }
export type SlicedCategory = { name: string; value: number; percent: number; color: string }

/**
 * Até 6 categorias com cor fixa; o resto vira "Outros" (cinza). A cor segue a entidade:
 * a fatia mantém seu slot pela ordem do id da categoria, e não pelo ranking do mês.
 */
export function sliceCategories(items: CategoryDatum[], max = 6, palette: ChartPalette = CHART_DARK): SlicedCategory[] {
  const ranked = [...items].sort((a, b) => Number(b.amount) - Number(a.amount))
  const kept = ranked.slice(0, max)
  const rest = ranked.slice(max)
  const bySlot = [...kept].sort((a, b) => (a.category_id ?? 0) - (b.category_id ?? 0))
  const color = new Map(bySlot.map((c, i) => [c.name, palette.categories[i] ?? palette.neutral]))
  const out: SlicedCategory[] = kept.map((c) => ({ name: c.name, value: Number(c.amount), percent: c.percent, color: color.get(c.name) ?? palette.neutral }))
  if (rest.length) {
    out.push({
      name: 'Outros',
      value: rest.reduce((s, c) => s + Number(c.amount), 0),
      percent: Math.round(rest.reduce((s, c) => s + c.percent, 0) * 10) / 10,
      color: palette.neutral,
    })
  }
  return out
}
