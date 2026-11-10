import { X } from 'lucide-react'
import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { MOTION, useReducedMotion } from '@/lib/motion'

/**
 * Modal sobre <dialog> nativo: foco preso, Esc fecha e leitores de tela anunciam o título.
 * Entra e sai com fade e escala discreta (CSS .modal). Ao fechar, o conteúdo continua montado durante a
 * saída e só então desmonta — assim a animação mostra o que fechou e o formulário reabre limpo.
 */
export function Modal({
  open,
  title,
  onClose,
  children,
}: {
  open: boolean
  title: string
  onClose: () => void
  children: ReactNode
}) {
  const ref = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  const reduced = useReducedMotion()
  const [mounted, setMounted] = useState(open)
  const [lastTitle, setLastTitle] = useState(title)
  const [snapshot, setSnapshot] = useState<ReactNode>(children)

  // Estado derivado (padrão do React): guarda o último conteúdo aberto para a animação de saída.
  if (open && !mounted) setMounted(true)
  if (open && snapshot !== children) setSnapshot(children)
  if (open && lastTitle !== title) setLastTitle(title)

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  useEffect(() => {
    if (open) return
    const t = window.setTimeout(() => setMounted(false), reduced ? 0 : MOTION.base + 60)
    return () => window.clearTimeout(t)
  }, [open, reduced])

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onClose={onClose}
      onClick={(e) => e.target === ref.current && onClose()}
      className="modal m-auto w-[calc(100%-2rem)] max-w-lg surface-strong rounded-2xl p-0 text-branco"
    >
      {mounted && (
        <div className="flex max-h-[calc(100dvh-2rem)] flex-col">
          <header className="flex items-center justify-between gap-4 border-b border-linha/10 px-5 py-4">
            <h2 id={titleId} className="text-lg font-semibold">
              {open ? title : lastTitle}
            </h2>
            <button
              type="button"
              onClick={onClose}
              aria-label="Fechar"
              className="flex size-9 items-center justify-center rounded-lg text-cinza-t transition-colors duration-150 hover:bg-linha/5 hover:text-branco"
            >
              <X aria-hidden className="size-5" />
            </button>
          </header>
          <div className="overflow-y-auto px-5 py-5">{open ? children : snapshot}</div>
        </div>
      )}
    </dialog>
  )
}
