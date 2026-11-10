import type { ButtonHTMLAttributes } from 'react'
import { cn } from '@/lib/cn'

type Variant = 'primary' | 'secondary' | 'ghost'

const variants: Record<Variant, string> = {
  // Texto escuro sobre o verde: contraste AA (o branco sobre esse verde não passa).
  primary: 'bg-suave text-marinho font-semibold shadow-[0_6px_20px_-8px_rgb(34_197_139/0.7)] hover:bg-suave-forte',
  secondary: 'bg-white/6 text-branco border border-white/12 hover:bg-white/10',
  ghost: 'text-cinza-t hover:text-branco hover:bg-white/6',
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
        'inline-flex min-h-10 items-center justify-center gap-2 rounded-xl px-4 text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-60',
        variants[variant],
        className,
      )}
      {...props}
    />
  )
}
