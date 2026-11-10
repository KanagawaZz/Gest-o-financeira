import { X } from 'lucide-react'
import { useEffect, useId, useRef, type ReactNode } from 'react'

/** Modal sobre <dialog> nativo: foco preso, Esc fecha e leitores de tela anunciam o título. */
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

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onClose={onClose}
      onClick={(e) => e.target === ref.current && onClose()}
      className="m-auto w-[calc(100%-2rem)] max-w-lg surface-strong rounded-2xl p-0 text-branco backdrop:bg-black/65 backdrop:backdrop-blur-sm"
    >
      {open && (
        <div className="flex max-h-[calc(100dvh-2rem)] flex-col">
          <header className="flex items-center justify-between gap-4 border-b border-white/10 px-5 py-4">
            <h2 id={titleId} className="text-lg font-semibold">
              {title}
            </h2>
            <button
              type="button"
              onClick={onClose}
              aria-label="Fechar"
              className="flex size-9 items-center justify-center rounded-lg text-cinza-t hover:bg-white/5 hover:text-branco"
            >
              <X aria-hidden className="size-5" />
            </button>
          </header>
          <div className="overflow-y-auto px-5 py-5">{children}</div>
        </div>
      )}
    </dialog>
  )
}
