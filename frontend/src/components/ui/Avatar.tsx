import { UserMark } from '@/components/brand/UserMark'
import { cn } from '@/lib/cn'

/** Ícone do usuário (marca do NEXO) num círculo; `online` mostra o ponto verde (com texto para leitores de tela).
 *  `name` fica na assinatura por compatibilidade; o ícone é decorativo (o nome aparece em texto ao lado). */
export function Avatar({ size = 'md', online = false, ringless = false }: { name?: string; size?: 'sm' | 'md' | 'lg'; online?: boolean; ringless?: boolean }) {
  return (
    <span className="relative inline-flex shrink-0">
      <span
        aria-hidden
        className={cn(
          'flex items-center justify-center overflow-hidden rounded-full avatar-disc',
          !ringless && 'ring-2 ring-suave/35',
          size === 'sm' && 'size-9 text-base',
          size === 'md' && 'size-11 text-lg',
          size === 'lg' && 'size-12 text-xl',
        )}
      >
        <UserMark />
      </span>
      {online && (
        <span className="absolute -bottom-0.5 -right-0.5 size-3.5 rounded-full border-2 border-aco bg-suave">
          <span className="sr-only">Conectado</span>
        </span>
      )}
    </span>
  )
}
