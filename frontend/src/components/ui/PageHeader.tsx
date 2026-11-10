import type { ReactNode } from 'react'

export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <header className="mb-7 flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0">
        <h1 className="text-3xl font-bold leading-tight tracking-tight over-photo sm:text-[40px]">{title}</h1>
        {subtitle && <p className="mt-1.5 max-w-[52ch] text-base text-branco over-photo sm:text-lg">{subtitle}</p>}
      </div>
      {action}
    </header>
  )
}
