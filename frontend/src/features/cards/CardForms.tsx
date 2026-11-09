import { useState, type FormEvent } from 'react'
import { Button } from '@/components/ui/Button'
import { Field, FormMessage, inputClass } from '@/components/ui/Field'
import { cn } from '@/lib/cn'
import { toFormErrors, type FormErrors } from '@/lib/errors'
import { parseMoneyInput, todayISO, toMoneyInput } from '@/lib/money'
import type { Category } from '@/types/finance'
import type { CardInput, CreditCard, PurchaseInput } from '@/types/planning'

function Actions({ submitting, label, onCancel }: { submitting: boolean; label: string; onCancel: () => void }) {
  return (
    <div className="flex justify-end gap-3 pt-2">
      <Button variant="secondary" onClick={onCancel}>Cancelar</Button>
      <Button type="submit" disabled={submitting}>{submitting ? 'Salvando…' : label}</Button>
    </div>
  )
}

export function CardForm({ card, onSubmit, onCancel }: { card?: CreditCard; onSubmit: (i: CardInput) => Promise<void>; onCancel: () => void }) {
  const [name, setName] = useState(card?.name ?? '')
  const [institution, setInstitution] = useState(card?.institution ?? '')
  const [limit, setLimit] = useState(card ? toMoneyInput(card.credit_limit) : '')
  const [closing, setClosing] = useState(String(card?.closing_day ?? ''))
  const [due, setDue] = useState(String(card?.due_day ?? ''))
  const [color, setColor] = useState(card?.color ?? '#6D91B5')
  const [errors, setErrors] = useState<FormErrors>({ fields: {}, message: null })
  const [submitting, setSubmitting] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (submitting) return
    const f: Record<string, string> = {}
    const parsed = parseMoneyInput(limit)
    const c = Number(closing)
    const d = Number(due)
    if (!name.trim()) f.name = 'Informe o apelido do cartão.'
    if (parsed === null || Number(parsed) <= 0) f.credit_limit = 'Informe o limite, como 5.000,00.'
    if (!Number.isInteger(c) || c < 1 || c > 31) f.closing_day = 'Dia entre 1 e 31.'
    if (!Number.isInteger(d) || d < 1 || d > 31) f.due_day = 'Dia entre 1 e 31.'
    if (Object.keys(f).length) return setErrors({ fields: f, message: null })
    setSubmitting(true)
    setErrors({ fields: {}, message: null })
    try {
      await onSubmit({ name: name.trim(), institution: institution.trim(), credit_limit: parsed as string, closing_day: c, due_day: d, color })
    } catch (err) {
      setErrors(toFormErrors(err))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
      <p className="rounded-lg bg-white/5 px-3 py-2 text-xs text-cinza-t">Por segurança, o NEXO não pede número do cartão, CVV nem senha.</p>
      <Field label="Apelido" error={errors.fields.name}>
        <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} maxLength={60} placeholder="Ex.: Nubank Roxinho" autoFocus />
      </Field>
      <Field label="Instituição (opcional)" error={errors.fields.institution}>
        <input className={inputClass} value={institution} onChange={(e) => setInstitution(e.target.value)} maxLength={60} />
      </Field>
      <Field label="Limite total (R$)" error={errors.fields.credit_limit}>
        <input className={inputClass} inputMode="decimal" placeholder="0,00" value={limit} onChange={(e) => setLimit(e.target.value)} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Dia de fechamento" error={errors.fields.closing_day} hint="Compras até este dia entram na fatura do mês.">
          <input className={inputClass} inputMode="numeric" value={closing} onChange={(e) => setClosing(e.target.value)} />
        </Field>
        <Field label="Dia de vencimento" error={errors.fields.due_day}>
          <input className={inputClass} inputMode="numeric" value={due} onChange={(e) => setDue(e.target.value)} />
        </Field>
      </div>
      <Field label="Cor" error={errors.fields.color}>
        <input type="color" className={cn(inputClass, 'p-1')} value={color} onChange={(e) => setColor(e.target.value.toUpperCase())} />
      </Field>
      {errors.message && <FormMessage>{errors.message}</FormMessage>}
      <Actions submitting={submitting} label="Salvar" onCancel={onCancel} />
    </form>
  )
}

export function PurchaseForm({ card, categories, onSubmit, onCancel }: { card: CreditCard; categories: Category[]; onSubmit: (i: PurchaseInput) => Promise<void>; onCancel: () => void }) {
  const [description, setDescription] = useState('')
  const [amount, setAmount] = useState('')
  const [category, setCategory] = useState('')
  const [date, setDate] = useState(todayISO())
  const [installments, setInstallments] = useState('1')
  const [notes, setNotes] = useState('')
  const [errors, setErrors] = useState<FormErrors>({ fields: {}, message: null })
  const [submitting, setSubmitting] = useState(false)
  const options = categories.filter((c) => c.kind === 'expense' && !c.is_archived)

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (submitting) return
    const f: Record<string, string> = {}
    const parsed = parseMoneyInput(amount)
    const n = Number(installments)
    if (!description.trim()) f.description = 'Informe a descrição.'
    if (parsed === null || Number(parsed) <= 0) f.amount = 'Informe um valor maior que zero.'
    if (!category) f.category = 'Escolha a categoria.'
    if (!date) f.date = 'Informe a data da compra.'
    if (!Number.isInteger(n) || n < 1 || n > 120) f.installments = 'Use de 1 a 120 parcelas.'
    if (Object.keys(f).length) return setErrors({ fields: f, message: null })
    setSubmitting(true)
    setErrors({ fields: {}, message: null })
    try {
      await onSubmit({ description: description.trim(), amount: parsed as string, category: Number(category), date, installments: n, notes })
    } catch (err) {
      setErrors(toFormErrors(err))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
      <p className="text-sm text-cinza-t">Cartão <strong className="font-medium text-branco">{card.name}</strong>. A compra entra na fatura e não altera o saldo da conta até a fatura ser paga.</p>
      <Field label="Descrição" error={errors.fields.description}>
        <input className={inputClass} value={description} onChange={(e) => setDescription(e.target.value)} maxLength={120} autoFocus />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Valor total (R$)" error={errors.fields.amount}>
          <input className={inputClass} inputMode="decimal" placeholder="0,00" value={amount} onChange={(e) => setAmount(e.target.value)} />
        </Field>
        <Field label="Parcelas" error={errors.fields.installments} hint="1 = à vista no cartão.">
          <input className={inputClass} inputMode="numeric" value={installments} onChange={(e) => setInstallments(e.target.value)} />
        </Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Data da compra" error={errors.fields.date}>
          <input className={inputClass} type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <Field label="Categoria" error={errors.fields.category}>
          <select className={inputClass} value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="">Selecione…</option>
            {options.map((c) => (<option key={c.id} value={c.id}>{c.name}</option>))}
          </select>
        </Field>
      </div>
      <Field label="Observações">
        <textarea className={cn(inputClass, 'min-h-16 py-2')} value={notes} onChange={(e) => setNotes(e.target.value)} />
      </Field>
      {errors.message && <FormMessage>{errors.message}</FormMessage>}
      <Actions submitting={submitting} label="Registrar compra" onCancel={onCancel} />
    </form>
  )
}
