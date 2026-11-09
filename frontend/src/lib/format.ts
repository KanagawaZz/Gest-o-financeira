const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

/** Formata valores monetários vindos da API (strings decimais) como R$ 3.200,00. Apenas apresentação. */
export function formatBRL(value: string | number): string {
  return brl.format(Number(value))
}

/** Formata 'YYYY-MM-DD' como dd/mm/aaaa sem passar por fuso horário. */
export function formatDate(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split('-')
  return `${d}/${m}/${y}`
}
