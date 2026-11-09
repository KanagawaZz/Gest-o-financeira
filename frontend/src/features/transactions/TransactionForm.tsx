import { useState, type FormEvent } from 'react'
import { Button } from '@/components/ui/Button'
import { Field, FormMessage, inputClass } from '@/components/ui/Field'
import { cn } from '@/lib/cn'
import { toFormErrors, type FormErrors } from '@/lib/errors'
import { parseMoneyInput, todayISO, toMoneyInput } from '@/lib/money'
import type { Category, FinancialAccount, Transaction, TransactionInput, TxType } from '@/types/finance'

const TYPES: { value: TxType; label: string }[] = [
  { value: 'expense', label: 'Despesa' },
  { value: 'income', label: 'Receita' },
  { value: 'transfer', label: 'Transferência' },
]

export function TransactionForm({
  transaction,
  initialType,
  accounts,
  categories,
  onSubmit,
  onCancel,
}: {
  transaction?: Transaction
  initialType?: TxType
  accounts: FinancialAccount[]
  categories: Category[]
  onSubmit: (input: TransactionInput) => Promise<void>
  onCancel: () => void
}) {
  const t = transaction
  // Itens arquivados só aparecem se já pertencem ao registro em edição.
  const accountOptions = accounts.filter((a) => !a.is_archived || a.id === t?.account || a.id === t?.destination_account)

  const [type, setType] = useState<TxType>(t?.type ?? initialType ?? 'expense')
  const [description, setDescription] = useState(t?.description ?? '')
  const [amount, setAmount] = useState(t ? toMoneyInput(t.amount) : '')
  const [category, setCategory] = useState(t?.category ? String(t.category) : '')
  const [account, setAccount] = useState(String(t?.account ?? accountOptions[0]?.id ?? ''))
  const [destination, setDestination] = useState(t?.destination_account ? String(t.destination_account) : '')
  const [date, setDate] = useState(t?.date ?? todayISO())
  const [status, setStatus] = useState<'pending' | 'realized'>(t?.status === 'pending' ? 'pending' : 'realized')
  const [settledDate, setSettledDate] = useState(t?.settled_date ?? '')
  const [competence, setCompetence] = useState(t?.competence_date ?? '')
  const [notes, setNotes] = useState(t?.notes ?? '')
  const [errors, setErrors] = useState<FormErrors>({ fields: {}, message: null })
  const [submitting, setSubmitting] = useState(false)

  const categoryOptions = categories.filter(
    (c) => c.kind === type && (!c.is_archived || c.id === t?.category),
  )
  const isTransfer = type === 'transfer'
  const settleLabel = type === 'income' ? 'Recebida' : type === 'expense' ? 'Paga' : 'Realizada'

  function changeType(next: TxType) {
    setType(next)
    setCategory('') // a categoria depende do tipo
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (submitting) return // evita envio duplicado

    const fields: Record<string, string> = {}
    const parsed = parseMoneyInput(amount)
    if (!description.trim()) fields.description = 'Informe a descrição.'
    if (parsed === null || Number(parsed) <= 0) fields.amount = 'Informe um valor maior que zero, como 487,52.'
    if (!account) fields.account = 'Escolha a conta.'
    if (isTransfer && !destination) fields.destination_account = 'Escolha a conta de destino.'
    if (isTransfer && destination && destination === account) fields.destination_account = 'O destino deve ser diferente da origem.'
    if (!isTransfer && !category) fields.category = 'Escolha a categoria.'
    if (!date) fields.date = 'Informe a data.'
    if (Object.keys(fields).length) return setErrors({ fields, message: null })

    setSubmitting(true)
    setErrors({ fields: {}, message: null })
    try {
      await onSubmit({
        type,
        description: description.trim(),
        amount: parsed as string,
        category: isTransfer ? null : Number(category),
        account: Number(account),
        destination_account: isTransfer ? Number(destination) : null,
        date,
        competence_date: competence || null,
        settled_date: status === 'realized' ? settledDate || null : null,
        status,
        notes,
      })
    } catch (err) {
      setErrors(toFormErrors(err)) // os dados digitados permanecem no formulário
    } finally {
      setSubmitting(false)
    }
  }

  if (!accountOptions.length) {
    return (
      <div className="flex flex-col gap-4">
        <p className="text-sm text-cinza-t">Cadastre uma conta antes de registrar movimentações.</p>
        <div className="flex justify-end">
          <Button variant="secondary" onClick={onCancel}>
            Fechar
          </Button>
        </div>
      </div>
    )
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
      <div role="radiogroup" aria-label="Tipo de movimentação" className="grid grid-cols-3 gap-1 rounded-lg border border-white/10 bg-marinho p-1">
        {TYPES.map(({ value, label }) => (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={type === value}
            onClick={() => changeType(value)}
            className={cn('min-h-10 rounded-md px-1 text-[13px] sm:px-2 sm:text-sm', type === value ? 'bg-suave/25 font-medium' : 'text-cinza-t hover:text-branco')}
          >
            {label}
          </button>
        ))}
      </div>

      <Field label="Descrição" error={errors.fields.description}>
        <input className={inputClass} value={description} onChange={(e) => setDescription(e.target.value)} maxLength={120} placeholder="Ex.: Supermercado" autoFocus />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Valor (R$)" error={errors.fields.amount}>
          <input className={inputClass} inputMode="decimal" placeholder="0,00" value={amount} onChange={(e) => setAmount(e.target.value)} />
        </Field>
        <Field label="Data" error={errors.fields.date}>
          <input className={inputClass} type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
      </div>

      {!isTransfer && (
        <Field label="Categoria" error={errors.fields.category}>
          <select className={inputClass} value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="">Selecione…</option>
            {categoryOptions.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>
      )}

      <div className={cn('grid gap-4', isTransfer && 'sm:grid-cols-2')}>
        <Field label={isTransfer ? 'Conta de origem' : 'Conta'} error={errors.fields.account}>
          <select className={inputClass} value={account} onChange={(e) => setAccount(e.target.value)}>
            {accountOptions.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </Field>
        {isTransfer && (
          <Field label="Conta de destino" error={errors.fields.destination_account}>
            <select className={inputClass} value={destination} onChange={(e) => setDestination(e.target.value)}>
              <option value="">Selecione…</option>
              {accountOptions.filter((a) => String(a.id) !== account).map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </Field>
        )}
      </div>

      <details className="rounded-lg border border-white/10 px-4 py-3">
        <summary className="cursor-pointer text-sm font-medium">Mais detalhes</summary>
        <div className="mt-4 flex flex-col gap-4">
          <Field label="Situação" error={errors.fields.status} hint="Pendentes não alteram o saldo até serem marcadas como realizadas.">
            <select className={inputClass} value={status} onChange={(e) => setStatus(e.target.value as 'pending' | 'realized')}>
              <option value="realized">{settleLabel}</option>
              <option value="pending">Pendente</option>
            </select>
          </Field>
          {status === 'realized' && (
            <Field label="Data efetiva" error={errors.fields.settled_date} hint="Em branco, usa a data da movimentação.">
              <input className={inputClass} type="date" value={settledDate} onChange={(e) => setSettledDate(e.target.value)} />
            </Field>
          )}
          <Field label="Data de competência" error={errors.fields.competence_date}>
            <input className={inputClass} type="date" value={competence} onChange={(e) => setCompetence(e.target.value)} />
          </Field>
          <Field label="Observações" error={errors.fields.notes}>
            <textarea className={cn(inputClass, 'min-h-20 py-2')} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </Field>
        </div>
      </details>

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
