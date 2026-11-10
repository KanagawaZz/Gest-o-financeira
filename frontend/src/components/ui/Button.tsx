import type { ButtonHTMLAttributes } from 'react'
import { cn } from '@/lib/cn'

type Variant = 'primary' | 'secondary' | 'ghost'

const variants: Record<Variant, string> = {
  // Texto sobre a cor de ação vem do tema (escuro sobre o verde, branco sobre o azul): contraste AA.
  primary: 'bg-suave text-on-acao font-semibold shadow-[0_6px_20px_-8px_var(--acao-glow)] hover:bg-suave-forte',
  secondary: 'chip text-branco',
  ghost: 'text-cinza-t hover:text-branco hover:bg-linha/6',
}

export function Button({
  variant = 'primary',
  className,
  type = 'button',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      type={type}
      className={cn(
        'btn inline-flex min-h-10 items-center justify-center gap-2 rounded-xl px-4 text-sm transition-[background-color,border-color,box-shadow,transform,filter,color] duration-150 ease-out hover:brightness-105 active:translate-y-px active:brightness-95 disabled:pointer-events-none disabled:opacity-60',
        variants[variant],
        className,
      )}
      {...props}
    />
  )
}
