import { Check, Moon, Sun, SunMoon, Sunrise, Sunset } from 'lucide-react'
import { useTheme, type ThemeMode, type ThemeStyle } from '@/app/providers/ThemeProvider'
import { Card } from '@/components/ui/Card'
import { segmentBox, segmentItem } from '@/components/ui/segmented'
import { cn } from '@/lib/cn'
import { PHASE_LABEL } from '@/lib/daylight'
import cidadeThumb from '@/assets/fundo/cidade-1280.webp'

const STYLES: { value: ThemeStyle; label: string; hint: string }[] = [
  { value: 'cidade', label: 'Cidade', hint: 'Foto e vidro · acompanha o horário' },
  { value: 'azul', label: 'Azul', hint: 'Claro e limpo · fundo branco' },
]

const OPTIONS: { value: ThemeMode; label: string; icon: typeof Sun }[] = [
  { value: 'auto', label: 'Pelo horário', icon: SunMoon },
  { value: 'manha', label: 'Manhã', icon: Sunrise },
  { value: 'tarde', label: 'Tarde', icon: Sun },
  { value: 'entardecer', label: 'Entardecer', icon: Sunset },
  { value: 'noite', label: 'Noite', icon: Moon },
]

const hhmm = (d: Date) => d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })

/** Miniatura de cada tema, desenhada com as cores fixas dele (não muda com o tema em uso). */
function StylePreview({ value }: { value: ThemeStyle }) {
  if (value === 'cidade') {
    return (
      <span aria-hidden className="relative block aspect-[16/9] overflow-hidden rounded-xl bg-[#0f1a2e]">
        <img src={cidadeThumb} alt="" loading="lazy" decoding="async" draggable={false} className="size-full object-cover" />
        <span className="absolute inset-x-[10%] bottom-[12%] top-[30%] grid grid-cols-3 gap-[5%]">
          {[0, 1, 2].map((i) => (
            <span key={i} className="rounded-md border border-white/25 bg-[rgb(13_22_36/0.72)]" />
          ))}
        </span>
        <span className="absolute left-[10%] top-[13%] h-[9%] w-[26%] rounded-full bg-[#22c58b]" />
      </span>
    )
  }
  return (
    <span aria-hidden className="relative block aspect-[16/9] overflow-hidden rounded-xl bg-white ring-1 ring-inset ring-black/10">
      <span className="absolute inset-x-0 top-0 h-[24%] bg-[#0a53d1]" />
      <span className="absolute inset-x-[10%] bottom-[12%] top-[36%] grid grid-cols-3 gap-[5%]">
        {[0, 1, 2].map((i) => (
          <span key={i} className="rounded-md bg-[#e9ebf0]" />
        ))}
      </span>
      <span className="absolute left-[10%] top-[8%] h-[8%] w-[26%] rounded-full bg-white/90" />
    </span>
  )
}

export function ThemeCard() {
  const { style, setStyle, mode, setMode, phase, day } = useTheme()
  return (
    <Card>
      <h2 className="text-base font-medium">Aparência</h2>
      <p className="mt-1 text-sm text-cinza-t">Escolha o tema do sistema. Vale só neste aparelho.</p>

      <div role="radiogroup" aria-label="Tema" className="mt-4 grid grid-cols-2 gap-3 sm:max-w-md">
        {STYLES.map(({ value, label, hint }) => {
          const active = style === value
          return (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => setStyle(value)}
              className={cn(
                'relative rounded-2xl border p-1.5 text-left transition-[border-color,box-shadow,background-color] duration-200 ease-out',
                active ? 'border-suave bg-suave/10 shadow-[0_0_0_3px_var(--acao-ring)]' : 'border-linha/15 hover:border-linha/35 hover:bg-linha/5',
              )}
            >
              <StylePreview value={value} />
              {active && (
                <span className="absolute right-3 top-3 flex size-6 items-center justify-center rounded-full bg-suave text-on-acao shadow-md ring-2 ring-white">
                  <Check aria-hidden className="size-4" strokeWidth={3} />
                </span>
              )}
              <span className="mt-2 block px-1.5 text-sm font-semibold">{label}</span>
              <span className="block px-1.5 pb-1 text-xs text-cinza-t">{hint}</span>
            </button>
          )
        })}
      </div>

      {style === 'cidade' ? (
        <>
          <h3 className="mt-6 text-sm font-medium">Período do dia</h3>
          <p className="mt-1 text-sm text-cinza-t">
            Pelo horário, o NEXO acompanha o sol em Cuiabá: manhã fresca, tarde de luz natural, entardecer dourado e noite em azul profundo.
          </p>
          <div role="radiogroup" aria-label="Período do tema" className={`${segmentBox} mt-3 grid-cols-2 sm:grid-cols-5`}>
            {OPTIONS.map(({ value, label, icon: Icon }) => (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={mode === value}
                onClick={() => setMode(value)}
                className={`${segmentItem(mode === value)} inline-flex items-center justify-center gap-1.5 ${value === 'auto' ? 'col-span-2 sm:col-span-1' : ''}`}
              >
                <Icon aria-hidden className="size-4 shrink-0" />
                {label}
              </button>
            ))}
          </div>
          <p className="mt-3 text-sm" aria-live="polite">
            {day ? (
              <>
                Agora: <strong className="font-semibold">{PHASE_LABEL[phase]}</strong>
                <span className="text-cinza-t">
                  {' '}
                  · {PHASE_LABEL[day.nextPhase].toLowerCase()} às {hhmm(day.nextChange)} · sol nasce {hhmm(day.sunrise)} e se põe {hhmm(day.sunset)}
                </span>
              </>
            ) : (
              <span className="text-cinza-t">Período fixo neste aparelho. Escolha “Pelo horário” para acompanhar o dia.</span>
            )}
          </p>
        </>
      ) : (
        <p className="mt-4 text-sm text-cinza-t" aria-live="polite">
          Tema claro, com fundo branco e azul como cor de ação. Ele tem um visual só e não muda com o horário.
        </p>
      )}
    </Card>
  )
}
