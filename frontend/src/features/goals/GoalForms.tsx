import { useState, type FormEvent } from 'react'
import { Button } from '@/components/ui/Button'
import { Field, FormMessage, inputClass } from '@/components/ui/Field'
import { cn } from '@/lib/cn'
import { toFormErrors, type FormErrors } from '@/lib/errors'
import { formatBRL } from '@/lib/format'
import { parseMoneyInput, todayISO, toMoneyInput } from '@/lib/money'
import type { FinancialAccount } from '@/types/finance'
import { PRIORITY_LABEL, type ContributionInput, type Goal, type GoalInput } from '@/types/planning'

function Actions({ submitting, label, onCancel }: { submitting: boolean; label: string; onCancel: () => void }) {
  return (
    <div className="flex justify-end gap-3 pt-2">
      <Button variant="secondary" onClick={onCancel}>Cancelar</Button>
      <Button type="submit" disabled={submitting}>{submitting ? 'Salvando…' : label}</Button>
    </div>
  )
}

export function GoalForm({ goal, onSubmit, onCancel }: { goal?: Goal; onSubmit: (i: GoalInput) => Promise<void>; onCancel: () => void }) {
  const [name, setName] = useState(goal?.name ?? '')
  const [target, setTarget] = useState(goal ? toMoneyInput(goal.target_amount) : '')
  const [date, setDate] = useState(goal?.target_date ?? '')
  const [priority, setPriority] = useState<Goal['priority']>(goal?.priority ?? 'medium')
  const [description, setDescription] = useState(goal?.description ?? '')
  const [errors, setErrors] = useState<FormErrors>({ fields: {}, message: null })
  const [submitting, setSubmitting] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (submitting) return
    const f: Record<string, string> = {}
    const parsed = parseMoneyInput(target)
    if (!name.trim()) f.name = 'Informe o nome da meta.'
    if (parsed === null || Number(parsed) <= 0) f.target_amount = 'Informe o valor desejado, como 10.000,00.'
    if (Object.keys(f).length) return setErrors({ fields: f, message: null })
    setSubmitting(true)
    setErrors({ fields: {}, message: null })
    try {
      await onSubmit({ name: name.trim(), target_amount: parsed as string, target_date: date || null, priority, description })
    } catch (err) {
      setErrors(toFormErrors(err))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
      <Field label="Nome" error={errors.fields.name}>
        <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} maxLength={80} placeholder="Ex.: Reserva de emergência, Viagem" autoFocus />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Valor desejado (R$)" error={errors.fields.target_amount}>
          <input className={inputClass} inputMode="decimal" placeholder="0,00" value={target} onChange={(e) => setTarget(e.target.value)} />
        </Field>
        <Field label="Data-alvo (opcional)" error={errors.fields.target_date}>
          <input className={inputClass} type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
      </div>
      <Field label="Prioridade" error={errors.fields.priority}>
        <select className={inputClass} value={priority} onChange={(e) => setPriority(e.target.value as Goal['priority'])}>
          {Object.entries(PRIORITY_LABEL).map(([v, l]) => (<option key={v} value={v}>{l}</option>))}
        </select>
      </Field>
      <Field label="Descrição (opcional)">
        <textarea className={cn(inputClass, 'min-h-16 py-2')} value={description} onChange={(e) => setDescription(e.target.value)} />
      </Field>
      {errors.message && <FormMessage>{errors.message}</FormMessage>}
      <Actions submitting={submitting} label="Salvar" onCancel={onCancel} />
    </form>
  )
}

export function ContributionForm({ goal, accounts, onSubmit, onCancel }: { goal: Goal; accounts: FinancialAccount[]; onSubmit: (i: ContributionInput) => Promise<void>; onCancel: () => void }) {
  const active = accounts.filter((a) => !a.is_archived)
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState(todayISO())
  const [source, setSource] = useState(String(active[0]?.id ?? ''))
  const [reserve, setReserve] = useState('')
  const [errors, setErrors] = useState<FormErrors>({ fields: {}, message: null })
  const [submitting, setSubmitting] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (submitting) return
    const f: Record<string, string> = {}
    const parsed = parseMoneyInput(amount)
    if (parsed === null || Number(parsed) <= 0) f.amount = 'Informe um valor maior que zero.'
    if (!source) f.account = 'Escolha a conta de origem.'
    if (!reserve) f.destination_account = 'Escolha a conta onde o dinheiro será guardado.'
    if (source && reserve && source === reserve) f.destination_account = 'A reserva deve ser diferente da origem.'
    if (Object.keys(f).length) return setErrors({ fields: f, message: null })
    setSubmitting(true)
    setErrors({ fields: {}, message: null })
    try {
      await onSubmit({ amount: parsed as string, date, account: Number(source), destination_account: Number(reserve), notes: '' })
    } catch (err) {
      setErrors(toFormErrors(err))
    } finally {
      setSubmitting(false)
    }
  }

  if (active.length < 2) {
    return (
      <div className="flex flex-col gap-4">
        <p className="text-sm text-cinza-t">Para guardar dinheiro de verdade, cadastre uma conta de reserva (poupança, investimento…). O aporte é uma transferência entre contas; sem movimentação real, a meta não conta.</p>
        <div className="flex justify-end"><Button variant="secondary" onClick={onCancel}>Fechar</Button></div>
      </div>
    )
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
      <p className="text-sm text-cinza-t">Meta <strong className="font-medium text-branco">{goal.name}</strong> · faltam {formatBRL(goal.progress.remaining_amount)}. O aporte é uma transferência real entre suas contas.</p>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Valor (R$)" error={errors.fields.amount}>
          <input className={inputClass} inputMode="decimal" placeholder="0,00" value={amount} onChange={(e) => setAmount(e.target.value)} autoFocus />
        </Field>
        <Field label="Data">
          <input className={inputClass} type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Sai da conta" error={errors.fields.account}>
          <select className={inputClass} value={source} onChange={(e) => setSource(e.target.value)}>
            {active.map((a) => (<option key={a.id} value={a.id}>{a.name}</option>))}
          </select>
        </Field>
        <Field label="Guardar em (reserva)" error={errors.fields.destination_account}>
          <select className={inputClass} value={reserve} onChange={(e) => setReserve(e.target.value)}>
            <option value="">Selecione…</option>
            {active.filter((a) => String(a.id) !== source).map((a) => (<option key={a.id} value={a.id}>{a.name}</option>))}
          </select>
        </Field>
      </div>
      {errors.message && <FormMessage>{errors.message}</FormMessage>}
      <Actions submitting={submitting} label="Guardar dinheiro" onCancel={onCancel} />
    </form>
  )
}
