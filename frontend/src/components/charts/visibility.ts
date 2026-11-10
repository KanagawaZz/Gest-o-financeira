import { createContext, useContext, useEffect, useState, type RefObject } from 'react'

/** Se o gráfico já apareceu na tela. Sem provedor (ou sem IntersectionObserver): visível. */
export const ChartVisibleContext = createContext(true)
export const useChartVisible = () => useContext(ChartVisibleContext)

/**
 * Fica `true` na primeira vez que o elemento entra na tela (e não volta a `false`).
 * Os gráficos só montam as séries a partir daí: a animação acontece quando a pessoa vê,
 * e gráficos abaixo da dobra não gastam CPU animando fora da tela.
 */
export function useInViewOnce(ref: RefObject<Element | null>): boolean {
  const supported = typeof window !== 'undefined' && 'IntersectionObserver' in window
  const [seen, setSeen] = useState(!supported)
  useEffect(() => {
    const el = ref.current
    if (!el || seen || !supported) return
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setSeen(true)
          io.disconnect()
        }
      },
      { threshold: 0.2 },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [ref, seen, supported])
  return seen
}
