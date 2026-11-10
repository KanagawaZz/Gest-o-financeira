import { useState, type FormEvent } from 'react'
import { Button } from '@/components/ui/Button'
import { Field, FormMessage, inputClass } from '@/components/ui/Field'
import { toFormErrors, type FormErrors } from '@/lib/errors'
import { parseMoneyInput, todayISO, toMoneyInput } from '@/lib/money'
import type { Category, FinancialAccount } from '@/types/finance'
import { FREQUENCY_LABEL, type Frequency, type RecurringInput, type RecurringRule } from '@/types/planning'

export type RuleFormValue = { once: boolean; input: RecurringInput }

/** Cadastro de conta/compromisso: pontual ("Única vez") ou recorrente (semanal, mensal, anual, personalizada). */
export function RuleForm({
  rule,
  accounts,
  categories,
  onSubmit,
  onCancel,
}: {
  rule?: RecurringRule
  accounts: FinancialAccount[]
  categories: Category[]
  onSubmit: (v: RuleFormValue) => Promise<void>
  onCancel: () => void
}) {
  const editing = !!rule
  const accountOptions = accounts.filter((a) => !a.is_archived || a.id === rule?.account)
  const [type, setType] = useState<'income' | 'expense'>(rule?.type ?? 'expense')
  const [description, setDescription] = useState(rule?.description ?? '')
  const [amount, setAmount] = useState(rule ? toMoneyInput(rule.amount) : '')
  const [category, setCategory] = useState(rule ? String(rule.category) : '')
  const [account, setAccount] = useState(String(rule?.account ?? accountOptions[0]?.id ?? ''))
  const [frequency, setFrequency] = useState<Frequency | 'once'>(rule?.frequency ?? 'monthly')
  const [interval, setInterval] = useState(rule?.interval_days ? String(rule.interval_days) : '')
  const [start, setStart] = useState(rule?.start_date ?? todayISO())
  const [end, setEnd] = useState(rule?.end_date ?? '')
  const [variable, setVariable] = useState(rule?.variable ?? false)
  const [notes, setNotes] = useState(rule?.notes ?? '')
  const [applyFuture, setApplyFuture] = useState(true)
  const [errors, setErrors] = useState<FormErrors>({ fields: {}, message: null })
  const [submitting, setSubmitting] = useState(false)

  const once = frequency === 'once'
  const categoryOptions = categories.filter((c) => c.kind === type && (!c.is_archived || c.id === rule?.category))

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (submitting) return
    const f: Record<string, string> = {}
    const parsed = parseMoneyInput(amount)
    if (!description.trim()) f.description = 'Informe o nome da conta.'
    if (parsed === null || Number(parsed) <= 0) f.amount = 'Informe um valor maior que zero, como 100,00.'
    if (!category) f.category = 'Escolha a categoria.'
    if (!account) f.account = 'Escolha a conta de pagamento.'
    if (!start) f.start_date = 'Informe a data.'
    if (frequency === 'custom' && (!interval || Number(interval) < 1)) f.interval_days = 'Informe a cada quantos dias.'
    if (end && start && end < start) f.end_date = 'A data final não pode ser anterior à inicial.'
    if (Object.keys(f).length) return setErrors({ fields: f, message: null })

    setSubmitting(true)
    setErrors({ fields: {}, message: null })
    try {
      await onSubmit({
        once,
        input: {
          description: description.trim(), type, amount: parsed as string, category: Number(category), account: Number(account),
          frequency: once ? 'monthly' : frequency, interval_days: frequency === 'custom' ? Number(interval) : null,
          start_date: start, end_date: once ? null : end || null, variable: once ? false : variable, notes,
          ...(editing && { apply_to_future: applyFuture }),
        },
      })  // fmt: skip
    } catch (err) {
      setErrors(toFormErrors(err))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
      <Field label="Tipo">
        <select className={inputClass} value={type} onChange={(e) => { setType(e.target.value as 'income' | 'expense'); setCategory('') }} disabled={editing}>
          <option value="expense">Conta a pagar (despesa)</option>
          <option value="income">Valor a receber (receita)</option>
        </select>
      </Field>
      <Field label="Nome" error={errors.fields.description}>
        <input className={inputClass} value={description} onChange={(e) => setDescription(e.target.value)} maxLength={120} placeholder="Ex.: Internet, Aluguel, Salário" autoFocus />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Valor (R$)" error={errors.fields.amount}>
          <input className={inputClass} inputMode="decimal" placeholder="0,00" value={amount} onChange={(e) => setAmount(e.target.value)} />
        </Field>
        <Field label="Categoria" error={errors.fields.category}>
          <select className={inputClass} value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="">Selecione…</option>
            {categoryOptions.map((c) => (<option key={c.id} value={c.id}>{c.name}</option>))}
          </select>
        </Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Conta" error={errors.fields.account}>
          <select className={inputClass} value={account} onChange={(e) => setAccount(e.target.value)}>
            {accountOptions.map((a) => (<option key={a.id} value={a.id}>{a.name}</option>))}
          </select>
        </Field>
        <Field label="Frequência" error={errors.fields.frequency}>
          <select className={inputClass} value={frequency} onChange={(e) => setFrequency(e.target.value as Frequency | 'once')} disabled={editing}>
            <option value="once">Única vez</option>
            {Object.entries(FREQUENCY_LABEL).map(([v, l]) => (<option key={v} value={v}>{l}</option>))}
          </select>
        </Field>
      </div>
      {frequency === 'custom' && (
        <Field label="Repetir a cada (dias)" error={errors.fields.interval_days}>
          <input className={inputClass} inputMode="numeric" value={interval} onChange={(e) => setInterval(e.target.value)} disabled={editing} />
        </Field>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={once ? 'Vencimento' : 'Primeiro vencimento'} error={errors.fields.start_date}>
          <input className={inputClass} type="date" value={start} onChange={(e) => setStart(e.target.value)} disabled={editing} />
        </Field>
        {!once && (
          <Field label="Data final (opcional)" error={errors.fields.end_date} hint="Em branco, repete sem data para acabar.">
            <input className={inputClass} type="date" value={end} onChange={(e) => setEnd(e.target.value)} />
          </Field>
        )}
      </div>
      {!once && (
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" className="mt-0.5 size-4 accent-suave" checked={variable} onChange={(e) => setVariable(e.target.checked)} />
          <span>
            Valor variável (estimado)
            <span className="block text-xs text-cinza-t">Contas como luz ou água. Nas projeções, entra como estimativa, não como valor garantido.</span>
          </span>
        </label>
      )}
      <Field label="Observações">
        <textarea className={`${inputClass} min-h-16 py-2`} value={notes} onChange={(e) => setNotes(e.target.value)} />
      </Field>
      {editing && (
        <label className="flex items-start gap-2 rounded-lg border border-linha/10 p-3 text-sm">
          <input type="checkbox" className="mt-0.5 size-4 accent-suave" checked={applyFuture} onChange={(e) => setApplyFuture(e.target.checked)} />
          <span>
            Aplicar às próximas ocorrências ainda não pagas
            <span className="block text-xs text-cinza-t">O que já foi pago e o histórico não mudam. Desmarcado, só novas ocorrências usarão os dados atualizados.</span>
          </span>
        </label>
      )}
      {errors.message && <FormMessage>{errors.message}</FormMessage>}
      <div className="flex justify-end gap-3 pt-2">
        <Button variant="secondary" onClick={onCancel}>Cancelar</Button>
        <Button type="submit" disabled={submitting}>{submitting ? 'Salvando…' : 'Salvar'}</Button>
      </div>
    </form>
  )
}
