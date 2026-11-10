import { useEffect, type RefObject } from 'react'

/** Fecha um menu/painel ao clicar fora ou apertar Esc (devolvendo o foco a quem abriu, se informado). */
export function useDismiss(open: boolean, ref: RefObject<HTMLElement | null>, close: () => void, returnFocus?: RefObject<HTMLElement | null>) {
  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) close()
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      close()
      returnFocus?.current?.focus()
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open, ref, close, returnFocus])
}
