import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { PageHeader } from '@/components/ui/PageHeader'
import { Tabs } from '@/components/ui/Tabs'
import { monthLong } from '@/lib/chart'
import { useAuth } from '../auth/AuthProvider'
import { OverviewTab } from './OverviewTab'
import { ProjectionTab } from './ProjectionTab'
import { SimulatorTab } from './SimulatorTab'

type Tab = 'overview' | 'projection' | 'simulator'
const TABS: { value: Tab; label: string }[] = [
  { value: 'overview', label: 'Resumo' },
  { value: 'projection', label: 'Projeção' },
  { value: 'simulator', label: 'Simulador' },
]

function currentMonth(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}
function shift(ym: string, delta: number): string {
  const [y = 0, m = 1] = ym.split('-').map(Number)
  const d = new Date(y, m - 1 + delta, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export function DashboardPage() {
  const { user } = useAuth()
  const [tab, setTab] = useState<Tab>('overview')
  const [month, setMonth] = useState(currentMonth)
  const name = user?.first_name || user?.username

  return (
    <section>
      <PageHeader title={`Olá, ${name}!`} subtitle="Aqui está um resumo da sua vida financeira." />
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <Tabs items={TABS} value={tab} onChange={setTab} label="Seções do painel" />
        {tab === 'overview' && (
          <div className="flex items-center gap-1">
            <Button variant="ghost" className="px-2" aria-label="Mês anterior" onClick={() => setMonth((m) => shift(m, -1))}>
              <ChevronLeft aria-hidden className="size-5" />
            </Button>
            <h2 className="min-w-36 text-center text-base font-medium first-letter:uppercase" aria-live="polite">
              {monthLong(month)}
            </h2>
            <Button variant="ghost" className="px-2" aria-label="Próximo mês" onClick={() => setMonth((m) => shift(m, 1))}>
              <ChevronRight aria-hidden className="size-5" />
            </Button>
          </div>
        )}
      </div>
      {tab === 'overview' && <OverviewTab month={month} />}
      {tab === 'projection' && <ProjectionTab />}
      {tab === 'simulator' && <SimulatorTab />}
    </section>
  )
}
