import { useState } from 'react'
import { PageHeader } from '@/components/ui/PageHeader'
import { PeriodPicker } from '@/components/ui/PeriodPicker'
import { Tabs } from '@/components/ui/Tabs'
import { monthLong } from '@/lib/chart'
import { useAuth } from '../auth/AuthProvider'
import { currentYM } from './due'
import { OverviewTab } from './OverviewTab'
import { ProjectionTab } from './ProjectionTab'
import { SimulatorTab } from './SimulatorTab'

type Tab = 'overview' | 'projection' | 'simulator'
const TABS: { value: Tab; label: string }[] = [
  { value: 'overview', label: 'Resumo' },
  { value: 'projection', label: 'Projeção' },
  { value: 'simulator', label: 'Simulador' },
]

function shift(ym: string, delta: number): string {
  const [y = 0, m = 1] = ym.split('-').map(Number)
  const d = new Date(y, m - 1 + delta, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}


export function DashboardPage() {
  const { user } = useAuth()
  const [tab, setTab] = useState<Tab>('overview')
  const [month, setMonth] = useState(currentYM)
  const name = user?.first_name || user?.username

  return (
    <section>
      <PageHeader
        title={`Olá, ${name}!`}
        subtitle="Aqui está um resumo da sua vida financeira."
        action={
          tab === 'overview' ? (
            <PeriodPicker label={monthLong(month)} onPrev={() => setMonth((m) => shift(m, -1))} onNext={() => setMonth((m) => shift(m, 1))} />
          ) : undefined
        }
      />
      <div className="-mt-2 mb-6">
        <Tabs items={TABS} value={tab} onChange={setTab} label="Seções do painel" />
      </div>
      {tab === 'overview' && <OverviewTab month={month} />}
      {tab === 'projection' && <ProjectionTab />}
      {tab === 'simulator' && <SimulatorTab />}
    </section>
  )
}
