import { AlertTriangle } from 'lucide-react'
import { cn } from '@/lib/cn'
import { Button } from './Button'

type Shape = 'list' | 'cards' | 'kpis' | 'chart'

function Bar({ className }: { className?: string }) {
  return <span aria-hidden className={cn('skeleton block h-3', className)} />
}

/**
 * Carregamento com a forma do conteúdo que vai chegar (skeleton), em vez de uma tela vazia ou spinner.
 * O texto fica só para leitores de tela.
 */
export function LoadingBlock({ label = 'Carregando…', shape = 'list' }: { label?: string; shape?: Shape }) {
  return (
    <div role="status" className="content-in">
      <span className="sr-only">{label}</span>
      {shape === 'list' && (
        <div className="surface divide-y divide-linha/8 rounded-2xl">
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="flex items-center gap-4 px-4 py-4">
              <span aria-hidden className="skeleton size-10 shrink-0 rounded-full" />
              <div className="flex-1 space-y-2">
                <Bar className="h-3.5" />
                <Bar className="w-1/3" />
              </div>
              <Bar className="h-4 w-24" />
            </div>
          ))}
        </div>
      )}
      {(shape === 'cards' || shape === 'kpis') && (
        <div className={cn('grid gap-3 md:gap-4', shape === 'kpis' ? 'grid-cols-2 xl:grid-cols-3' : 'md:grid-cols-2')}>
          {Array.from({ length: shape === 'kpis' ? 6 : 4 }, (_, i) => (
            <div key={i} className="surface flex gap-4 rounded-2xl p-4 md:p-5">
              <span aria-hidden className="skeleton hidden size-14 shrink-0 rounded-2xl md:block" />
              <div className="flex-1 space-y-3">
                <Bar className="w-1/2" />
                <Bar className="h-6 w-3/4" />
                <Bar className="w-5/6" />
              </div>
            </div>
          ))}
        </div>
      )}
      {shape === 'chart' && (
        <div className="surface rounded-2xl p-5">
          <Bar className="mb-6 h-4 w-48" />
          <div className="flex h-56 items-end gap-3">
            {[45, 70, 55, 85, 60, 75, 50, 90, 65].map((h, i) => (
              <span key={i} aria-hidden className="skeleton flex-1 rounded-b-none rounded-t-md" style={{ height: `${h}%` }} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export function ErrorBlock({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div role="alert" className="surface flex flex-col items-center gap-3 rounded-2xl !border-queimado/35 bg-queimado/10 px-6 py-10 text-center">
      <AlertTriangle aria-hidden className="size-6 text-queimado-t" />
      <p className="text-sm">{message}</p>
      <Button variant="secondary" onClick={onRetry}>
        Tentar novamente
      </Button>
    </div>
  )
}
