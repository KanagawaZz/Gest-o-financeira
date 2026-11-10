import { AlertTriangle, CheckCircle2, XCircle } from 'lucide-react'
import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react'
import { cn } from '@/lib/cn'
import { MOTION } from '@/lib/motion'

type Kind = 'success' | 'warning' | 'error'
type ToastApi = { success: (message: string) => void; warning: (message: string) => void; error: (message: string) => void }
type Shown = { id: number; kind: Kind; message: string; leaving: boolean }

const ToastContext = createContext<ToastApi | null>(null)
const VISIBLE_MS = 4000

const STYLE: Record<Kind, { icon: typeof CheckCircle2; className: string; iconClass: string }> = {
  success: { icon: CheckCircle2, className: '!border-salvia/40', iconClass: 'text-salvia-t' },
  warning: { icon: AlertTriangle, className: '!border-ambar/45', iconClass: 'text-ambar-t' },
  error: { icon: XCircle, className: '!border-queimado/45', iconClass: 'text-queimado-t' },
}

/** Avisos curtos: entram de lado, somem sozinhos e nunca bloqueiam a tela (não pegam cliques). */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<Shown | null>(null)
  const timers = useRef<number[]>([])

  const show = useCallback((kind: Kind, message: string) => {
    timers.current.forEach((t) => window.clearTimeout(t))
    setToast({ id: Date.now(), kind, message, leaving: false })
    timers.current = [
      window.setTimeout(() => setToast((t) => t && { ...t, leaving: true }), VISIBLE_MS),
      window.setTimeout(() => setToast(null), VISIBLE_MS + MOTION.base),
    ]
  }, [])
  const api = useMemo<ToastApi>(
    () => ({ success: (m) => show('success', m), warning: (m) => show('warning', m), error: (m) => show('error', m) }),
    [show],
  )

  const style = toast ? STYLE[toast.kind] : null
  const Icon = style?.icon
  return (
    <ToastContext.Provider value={api}>
      {children}
      <div
        role="status"
        aria-live="polite"
        className="pointer-events-none fixed inset-x-4 bottom-[calc(6rem+env(safe-area-inset-bottom))] z-50 flex justify-center sm:left-auto sm:justify-end lg:bottom-6 lg:right-6"
      >
        {toast && style && Icon && (
          <p
            key={toast.id}
            className={cn('surface-strong flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm', style.className, toast.leaving ? 'toast-out' : 'toast-in')}
          >
            <Icon aria-hidden className={cn('size-4 shrink-0', style.iconClass)} />
            {toast.message}
          </p>
        )}
      </div>
    </ToastContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useToast(): ToastApi {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast deve ser usado dentro de <ToastProvider>.')
  return ctx
}
