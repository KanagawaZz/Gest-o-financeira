import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: LucideIcon
  title: string
  description: string
  action?: ReactNode
}) {
  return (
    <div className="flex flex-col items-center gap-3 surface rounded-2xl border-dashed !border-white/18 px-6 py-14 text-center">
      <span className="flex size-12 items-center justify-center rounded-2xl bg-suave/15 text-suave-t">
        <Icon aria-hidden className="size-6" />
      </span>
      <h2 className="text-base font-medium">{title}</h2>
      <p className="max-w-md text-sm text-cinza-t">{description}</p>
      {action}
    </div>
  )
}
