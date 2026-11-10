import { useEffect, useRef, useState } from 'react'
import { easeOutCubic, MOTION, useReducedMotion } from './motion'

/**
 * Conta de um valor até outro em UNIDADES INTEIRAS (centavos, décimos…): nunca mostra um valor que não
 * existe em reais e centavos, não oscila e pousa exatamente no número real.
 * Primeira exibição: parte de zero (MOTION.data). Mudanças depois: parte do valor atual (MOTION.update),
 * e uma nova mudança no meio do caminho continua de onde está, sem salto.
 */
export function useCountUp(target: number | null): number | null {
  const reduced = useReducedMotion()
  const [shown, setShown] = useState<number | null>(() => (target === null ? null : reduced ? target : 0))
  const current = useRef<number | null>(shown)
  const started = useRef(false)

  useEffect(() => {
    if (target === null || reduced) {
      current.current = target // exibido direto (o retorno abaixo já usa o alvo)
      return
    }
    const from = current.current ?? 0
    const duration = started.current ? MOTION.update : MOTION.data
    started.current = true
    if (from === target) return
    // O início é o 1º quadro: o carimbo que o navegador passa ao quadro pode ser ANTERIOR ao instante em
    // que a animação foi agendada; medir a partir de performance.now() daria progresso negativo (e valor < 0).
    let t0 = -1
    let raf = 0
    const step = (now: number) => {
      if (t0 < 0) t0 = now
      const p = Math.min(1, Math.max(0, (now - t0) / duration))
      const value = p === 1 ? target : Math.round(from + (target - from) * easeOutCubic(p))
      current.current = value
      setShown(value)
      if (p < 1) raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [target, reduced])

  return reduced || target === null ? target : shown
}
