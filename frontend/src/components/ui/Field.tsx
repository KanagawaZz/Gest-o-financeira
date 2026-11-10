import { useId, type ReactElement, type ReactNode } from 'react'
import { cloneElement } from 'react'
import { cn } from '@/lib/cn'

export const inputClass =
  'min-h-11 w-full glass-field rounded-xl border border-linha/12 px-3 text-sm text-branco transition-[border-color,box-shadow] duration-200 ease-out placeholder:text-cinza-t/70 hover:border-linha/25 focus:border-suave focus-visible:shadow-[0_0_0_3px_var(--acao-ring)] aria-[invalid=true]:border-queimado/70 aria-[invalid=true]:shadow-[0_0_0_3px_rgb(230_86_86/0.18)] disabled:opacity-60'

/** Rótulo + controle + mensagem de erro ligados por id (acessível por leitor de tela). */
export function Field({
  label,
  error,
  hint,
  children,
  className,
}: {
  label: string
  error?: string
  hint?: string
  children: ReactElement<{ id?: string; 'aria-invalid'?: boolean; 'aria-describedby'?: string }>
  className?: string
}) {
  const id = useId()
  const describedBy = error ? `${id}-err` : hint ? `${id}-hint` : undefined
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      {cloneElement(children, { id, 'aria-invalid': error ? true : undefined, 'aria-describedby': describedBy })}
      {error ? (
        <p id={`${id}-err`} className="text-xs text-queimado-t">
          {error}
        </p>
      ) : (
        hint && (
          <p id={`${id}-hint`} className="text-xs text-cinza-t">
            {hint}
          </p>
        )
      )}
    </div>
  )
}

export function FormMessage({ children }: { children: ReactNode }) {
  return (
    <p role="alert" className="rounded-xl border border-queimado/30 bg-queimado/12 px-3 py-2 text-sm text-queimado-t">
      {children}
    </p>
  )
}
