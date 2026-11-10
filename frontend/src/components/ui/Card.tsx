import type { HTMLAttributes } from 'react'
import { cn } from '@/lib/cn'

/** Card de vidro. Espaçamento padrão menor no celular; se `className` trouxer um `p-*`, ele manda sozinho. */
export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  const customPadding = /(^|\s)p-/.test(className ?? '')
  return <div className={cn('surface rounded-2xl', !customPadding && 'p-4 sm:p-5', className)} {...props} />
}
