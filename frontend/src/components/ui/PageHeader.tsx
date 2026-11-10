import type { ReactNode } from 'react'

export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <header className="mb-7 flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0">
        <h1 className="text-3xl font-bold leading-tight tracking-tight drop-shadow-[0_2px_10px_rgb(0_0_0/0.5)] sm:text-[40px]">{title}</h1>
        {subtitle && <p className="mt-1.5 text-base text-branco/85 drop-shadow-[0_1px_6px_rgb(0_0_0/0.6)] sm:text-lg">{subtitle}</p>}
      </div>
      {action}
    </header>
  )
}
