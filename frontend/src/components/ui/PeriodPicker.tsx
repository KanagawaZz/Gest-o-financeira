import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react'

/** Pílula "‹ 📅 Novembro de 2026 ›" usada no painel, em Transações e em Relatórios. */
export function PeriodPicker({
  label,
  onPrev,
  onNext,
  prevLabel = 'Mês anterior',
  nextLabel = 'Próximo mês',
}: {
  label: string
  onPrev: () => void
  onNext: () => void
  prevLabel?: string
  nextLabel?: string
}) {
  const arrow = 'flex size-9 shrink-0 items-center justify-center rounded-full text-branco/85 hover:bg-linha/10 hover:text-branco'
  return (
    <div className="inline-flex items-center gap-1 surface rounded-full p-1.5">
      <button type="button" className={arrow} aria-label={prevLabel} onClick={onPrev}>
        <ChevronLeft aria-hidden className="size-5" />
      </button>
      <h2 className="flex min-w-40 items-center justify-center gap-2 px-1 text-[15px] font-medium" aria-live="polite">
        <CalendarDays aria-hidden className="size-5 shrink-0 text-cinza-t" />
        <span className="inline-block first-letter:uppercase">{label}</span>
      </h2>
      <button type="button" className={arrow} aria-label={nextLabel} onClick={onNext}>
        <ChevronRight aria-hidden className="size-5" />
      </button>
    </div>
  )
}
