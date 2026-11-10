import type { UpcomingItem } from '@/types/planning'

/** Rótulo e tom de cada vencimento (painel e notificações usam o mesmo texto). */
export const DUE_STATUS: Record<UpcomingItem['status'], { tone: 'danger' | 'warning' | 'neutral'; label: (d: number) => string }> = {
  overdue: { tone: 'danger', label: (d) => `Atrasada há ${Math.abs(d)} ${Math.abs(d) === 1 ? 'dia' : 'dias'}` },
  due_soon: { tone: 'warning', label: (d) => (d === 0 ? 'Vence hoje' : `Vence em ${d} ${d === 1 ? 'dia' : 'dias'}`) },
  pending: { tone: 'neutral', label: (d) => `Em ${d} dias` },
}

/** Mês corrente no formato da API ("2026-11"). */
export function currentYM(now = new Date()): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

/** Chave do resumo no cache: o sino e o painel compartilham a mesma consulta do mês atual. */
export const summaryKey = (month: string) => ['dashboard', 'summary', month] as const
