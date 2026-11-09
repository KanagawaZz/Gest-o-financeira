import { useState, type FormEvent } from 'react'
import { Button } from '@/components/ui/Button'
import { Field, FormMessage, inputClass } from '@/components/ui/Field'
import { toFormErrors, type FormErrors } from '@/lib/errors'
import { parseMoneyInput, toMoneyInput } from '@/lib/money'
import { ACCOUNT_TYPE_LABEL, type AccountInput, type AccountType, type FinancialAccount } from '@/types/finance'

export function AccountForm({
  account,
  onSubmit,
  onCancel,
}: {
  account?: FinancialAccount
  onSubmit: (input: AccountInput) => Promise<void>
  onCancel: () => void
}) {
  const [name, setName] = useState(account?.name ?? '')
  const [type, setType] = useState<AccountType>(account?.type ?? 'checking')
  const [balance, setBalance] = useState(account ? toMoneyInput(account.initial_balance) : '')
  const [color, setColor] = useState(account?.color ?? '#6D91B5')
  const [errors, setErrors] = useState<FormErrors>({ fields: {}, message: null })
  const [submitting, setSubmitting] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (submitting) return
    const fields: Record<string, string> = {}
    if (!name.trim()) fields.name = 'Informe o nome.'
    const parsed = balance.trim() ? parseMoneyInput(balance) : '0.00'
    if (parsed === null) fields.initial_balance = 'Use um valor como 1.500,00.'
    if (Object.keys(fields).length) return setErrors({ fields, message: null })

    setSubmitting(true)
    setErrors({ fields: {}, message: null })
    try {
      await onSubmit({ name: name.trim(), type, initial_balance: parsed ?? '0.00', color })
    } catch (err) {
      setErrors(toFormErrors(err))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
      <Field label="Nome" error={errors.fields.name}>
        <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} maxLength={60} autoFocus />
      </Field>
      <Field label="Tipo" error={errors.fields.type}>
        <select className={inputClass} value={type} onChange={(e) => setType(e.target.value as AccountType)}>
          {Object.entries(ACCOUNT_TYPE_LABEL).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </Field>
      <Field
        label="Saldo inicial"
        error={errors.fields.initial_balance}
        hint="Quanto havia na conta ao começar a usar o NEXO. As movimentações somam a partir daqui."
      >
        <input className={inputClass} inputMode="decimal" placeholder="0,00" value={balance} onChange={(e) => setBalance(e.target.value)} />
      </Field>
      <Field label="Cor" error={errors.fields.color}>
        <input type="color" className={`${inputClass} p-1`} value={color} onChange={(e) => setColor(e.target.value.toUpperCase())} />
      </Field>
      {errors.message && <FormMessage>{errors.message}</FormMessage>}
      <div className="flex justify-end gap-3 pt-2">
        <Button variant="secondary" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" disabled={submitting}>
          {submitting ? 'Salvando…' : 'Salvar'}
        </Button>
      </div>
    </form>
  )
}
