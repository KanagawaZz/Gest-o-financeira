import { useState } from 'react'
import { PageHeader } from '@/components/ui/PageHeader'
import { Tabs } from '@/components/ui/Tabs'
import { CommitmentsTab } from '../commitments/CommitmentsTab'
import { AccountsPage } from './AccountsPage'

type Tab = 'accounts' | 'commitments'

/** "Contas": contas financeiras + compromissos (contas a pagar/receber e regras recorrentes). */
export function AccountsHubPage() {
  const [tab, setTab] = useState<Tab>('commitments')
  return (
    <div>
      <Tabs
        label="Seções de contas"
        value={tab}
        onChange={setTab}
        items={[
          { value: 'commitments', label: 'Compromissos' },
          { value: 'accounts', label: 'Contas financeiras' },
        ]}
      />
      <div className="mt-6">
        {tab === 'accounts' ? (
          <AccountsPage />
        ) : (
          <>
            <PageHeader title="Compromissos" subtitle="O que você precisa pagar e receber, com vencimentos e alertas." />
            <CommitmentsTab />
          </>
        )}
      </div>
    </div>
  )
}
