import { useSyncExternalStore } from 'react'

/**
 * Tokens de movimento do NEXO (espelhados em index.css como --dur-* e --ease-out).
 * Uma curva só (desaceleração), poucas durações. Dados levam mais tempo porque são o momento principal.
 */
export const MOTION = {
  fast: 150, // botões, campos, ícones
  base: 240, // páginas, modais, avisos, menu
  data: 1100, // números e gráficos na primeira carga
  update: 800, // números quando o valor muda depois (rápido o bastante para não atrapalhar a leitura)
} as const

const QUERY = '(prefers-reduced-motion: reduce)'

/** Sem suporte a matchMedia (ex.: testes) conta como "reduzir movimento": tudo aparece no valor final. */
export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return true
  return window.matchMedia(QUERY).matches
}

function subscribe(onChange: () => void) {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return () => {}
  const mq = window.matchMedia(QUERY)
  mq.addEventListener('change', onChange)
  return () => mq.removeEventListener('change', onChange)
}

/** Acompanha a preferência do sistema ao vivo. */
export function useReducedMotion(): boolean {
  return useSyncExternalStore(subscribe, prefersReducedMotion, () => true)
}

/** Desaceleração cúbica: começa rápido e pousa suave no valor, sem passar dele (nada de oscilar). */
export const easeOutCubic = (t: number) => 1 - (1 - t) ** 3
