import { AlertTriangle } from 'lucide-react'
import { Button } from './Button'

export function LoadingBlock({ label = 'Carregando…' }: { label?: string }) {
  return (
    <div role="status" className="rounded-xl border border-white/8 bg-aco/50 px-6 py-12 text-center text-sm text-cinza-t">
      {label}
    </div>
  )
}

export function ErrorBlock({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div role="alert" className="flex flex-col items-center gap-3 rounded-xl border border-queimado/30 bg-queimado/10 px-6 py-10 text-center">
      <AlertTriangle aria-hidden className="size-6 text-queimado-t" />
      <p className="text-sm">{message}</p>
      <Button variant="secondary" onClick={onRetry}>
        Tentar novamente
      </Button>
    </div>
  )
}
