/**
 * Converte o que o usuário digitou ("1.234,56", "12,5", "50") para o formato da API ("1234.56").
 * Retorna null se não for um valor monetário válido (no máximo 2 casas decimais).
 * Só prepara o texto: os cálculos continuam no backend.
 */
export function parseMoneyInput(raw: string): string | null {
  const s = raw.trim().replace(/^R\$\s*/, '')
  if (!s) return null
  const normalized = s.includes(',') ? s.replace(/\./g, '').replace(',', '.') : s
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) return null
  const [int = '0', dec = ''] = normalized.split('.')
  return `${int.replace(/^0+(?=\d)/, '')}.${dec.padEnd(2, '0')}`
}

/** "487.52" (API) -> "487,52" (campo de edição). */
export function toMoneyInput(apiValue: string): string {
  return apiValue.replace('.', ',')
}

/** Data local de hoje em YYYY-MM-DD (evita o deslocamento de fuso de toISOString). */
export function todayISO(now = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`
}

export function monthRange(year: number, month: number): { from: string; to: string } {
  const p = (n: number) => String(n).padStart(2, '0')
  const last = new Date(year, month, 0).getDate()
  return { from: `${year}-${p(month)}-01`, to: `${year}-${p(month)}-${p(last)}` }
}
