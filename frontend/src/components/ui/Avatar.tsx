import { cn } from '@/lib/cn'

/** Inicial do nome num círculo; `online` mostra o ponto verde (com texto para leitores de tela). */
export function Avatar({ name, size = 'md', online = false }: { name: string; size?: 'sm' | 'md' | 'lg'; online?: boolean }) {
  const initial = (name.trim()[0] ?? '?').toUpperCase()
  return (
    <span className="relative inline-flex shrink-0">
      <span
        aria-hidden
        className={cn(
          'flex items-center justify-center rounded-full bg-[radial-gradient(circle_at_30%_25%,#1f4a3e,#0e2a24)] font-bold text-suave-t ring-2 ring-suave/35',
          size === 'sm' && 'size-9 text-base',
          size === 'md' && 'size-11 text-lg',
          size === 'lg' && 'size-12 text-xl',
        )}
      >
        {initial}
      </span>
      {online && (
        <span className="absolute -bottom-0.5 -right-0.5 size-3.5 rounded-full border-2 border-aco bg-suave">
          <span className="sr-only">Conectado</span>
        </span>
      )}
    </span>
  )
}
