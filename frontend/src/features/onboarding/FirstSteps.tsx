import { useQuery } from '@tanstack/react-query'
import { ArrowLeftRight, Check, CreditCard, Repeat, Target, Wallet, X, type LucideIcon } from 'lucide-react'
import { useId, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { cn } from '@/lib/cn'
import { dashboardApi } from '@/services/planning'
import type { Onboarding } from '@/types/planning'
import { useAuth } from '../auth/AuthProvider'
import { STEPS, isBlocked, isHidden, onboardingKey, progress, setHidden, type StepDef, type StepKey } from './steps'

const ICONS: Record<StepKey, LucideIcon> = { account: Wallet, recurring: Repeat, transaction: ArrowLeftRight, card: CreditCard, goal: Target }

function Step({ step, index, done, steps, highlight, onGo }: { step: StepDef; index: number; done: boolean; steps: Onboarding['steps']; highlight: boolean; onGo: (to: string) => void }) {
  const Icon = ICONS[step.key]
  const blocked = isBlocked(step, steps)
  return (
    <li className="flex gap-3 py-4 first:pt-0 last:pb-0">
      <span
        aria-hidden
        className={cn(
          'mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold',
          done ? 'bg-salvia/20 text-salvia-t' : highlight ? 'bg-suave text-on-acao' : 'bg-linha/10 text-branco',
        )}
      >
        {done ? <Check className="size-5" strokeWidth={2.5} /> : step.optional ? <Icon className="size-4" /> : index + 1}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <h3 className="text-[15px] font-semibold">{step.title}</h3>
          {done && <Badge tone="positive">Feito</Badge>}
        </div>
        {/* Passo feito fica só com o título: a explicação já cumpriu o papel e o painel sobe na tela. */}
        {!done && <p className="mt-1 text-sm text-cinza-t">{step.what}</p>}
        {!done && (
          <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5">
            <Button variant={highlight ? 'primary' : 'secondary'} disabled={blocked} onClick={() => onGo(step.to)}>
              {step.action}
            </Button>
            {blocked && <span className="text-xs text-cinza-t">Cadastre uma conta primeiro.</span>}
          </div>
        )}
      </div>
    </li>
  )
}

/**
 * Guia "Primeiros passos" no topo do painel: diz a quem acabou de se cadastrar o que fazer primeiro,
 * o que é cada coisa e marca sozinho o que já foi feito. Some quando tudo está feito ou ao ser ocultado
 * (volta por Configurações). É um apoio, não um bloqueio: se a consulta falhar, o painel segue normal.
 */
export function FirstSteps() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const titleId = useId()
  // `dismissed` cobre o clique desta visita; a preferência salva é lida a cada renderização porque o
  // usuário pode ainda estar carregando na primeira (um estado inicial fixo deixaria o guia oculto para sempre).
  const [dismissed, setDismissed] = useState(false)
  const hidden = dismissed || !user || isHidden(user.id)
  const q = useQuery({ queryKey: onboardingKey, queryFn: dashboardApi.onboarding, enabled: !!user && !hidden })

  if (!user || hidden || !q.data) return null
  const steps = q.data.steps
  const p = progress(steps)
  if (p.allDone) return null

  const hide = () => {
    setHidden(user.id, true)
    setDismissed(true)
  }
  const essential = STEPS.filter((s) => !s.optional)
  const optional = STEPS.filter((s) => s.optional && !steps[s.key])
  const percent = Math.round((100 * p.essentialDone) / p.essentialTotal)

  return (
    <section aria-labelledby={titleId} className="mb-6">
      <Card>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 id={titleId} className="text-lg font-semibold">
              {p.allEssentialDone ? 'Tudo pronto para começar' : 'Primeiros passos'}
            </h2>
            <p className="mt-1 text-sm text-cinza-t">
              {p.allEssentialDone
                ? 'O essencial está configurado. O painel abaixo já mostra sua vida financeira.'
                : 'Seu NEXO começa zerado. Siga esta ordem para deixar tudo organizado; leva poucos minutos.'}
            </p>
          </div>
          <button
            type="button"
            onClick={hide}
            aria-label="Ocultar primeiros passos"
            title="Ocultar (você pode reabrir em Configurações)"
            className="-mr-1 -mt-1 flex size-10 shrink-0 items-center justify-center rounded-lg text-cinza-t transition-colors duration-150 hover:bg-linha/6 hover:text-branco"
          >
            <X aria-hidden className="size-5" />
          </button>
        </div>

        <div className="mt-4">
          <div className="flex items-center justify-between text-xs text-cinza-t">
            <span>
              {p.essentialDone} de {p.essentialTotal} passos essenciais
            </span>
            <span className="tabular-nums">{percent}%</span>
          </div>
          <div
            role="progressbar"
            aria-label="Progresso dos primeiros passos"
            aria-valuemin={0}
            aria-valuemax={p.essentialTotal}
            aria-valuenow={p.essentialDone}
            aria-valuetext={`${p.essentialDone} de ${p.essentialTotal} passos essenciais`}
            className="mt-1.5 h-2 overflow-hidden rounded-full bg-linha/10"
          >
            <div className="h-full rounded-full bg-suave transition-[width] duration-500 ease-out" style={{ width: `${percent}%` }} />
          </div>
        </div>

        <ol className="mt-5 divide-y divide-linha/8">
          {essential.map((s, i) => (
            <Step key={s.key} step={s} index={i} done={steps[s.key]} steps={steps} highlight={p.next === s.key} onGo={navigate} />
          ))}
        </ol>

        {optional.length > 0 && (
          <>
            <p className="mt-6 text-xs font-semibold uppercase tracking-wide text-cinza-t">Opcional, quando fizer sentido</p>
            <ul className="mt-3 divide-y divide-linha/8">
              {optional.map((s, i) => (
                <Step key={s.key} step={s} index={i} done={false} steps={steps} highlight={false} onGo={navigate} />
              ))}
            </ul>
          </>
        )}

        <p className="mt-5 border-t border-linha/8 pt-4 text-xs text-cinza-t">
          As categorias (Alimentação, Moradia, Salário…) já vêm prontas. Ajuste quando quiser em Categorias.
        </p>
        {p.allEssentialDone && (
          <div className="mt-4">
            <Button onClick={hide}>Concluir</Button>
          </div>
        )}
      </Card>
    </section>
  )
}
