import { useQuery } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { Button } from '@/components/ui/Button'
import { Field, FormMessage, inputClass } from '@/components/ui/Field'
import { cn } from '@/lib/cn'
import { toFormErrors, type FormErrors } from '@/lib/errors'
import { formatBRL, formatDate } from '@/lib/format'
import { parseMoneyInput, todayISO } from '@/lib/money'
import { plansApi } from '@/services/planning'
import type { Category, FinancialAccount } from '@/types/finance'
import type { CreditCard, PlanInput } from '@/types/planning'

/** Nova compra parcelada. A prévia vem do backend, que usa o mesmo cálculo da criação (soma sempre fecha). */
export function PlanForm({
  accounts,
  cards,
  categories,
  onSubmit,
  onCancel,
}: {
  accounts: FinancialAccount[]
  cards: CreditCard[]
  categories: Category[]
  onSubmit: (input: PlanInput) => Promise<void>
  onCancel: () => void
}) {
  const accountOptions = accounts.filter((a) => !a.is_archived)
  const cardOptions = cards.filter((c) => !c.is_archived)
  const expenseCategories = categories.filter((c) => c.kind === 'expense' && !c.is_archived)

  const [description, setDescription] = useState('')
  const [total, setTotal] = useState('')
  const [count, setCount] = useState('12')
  const [first, setFirst] = useState(todayISO())
  const [category, setCategory] = useState('')
  const [via, setVia] = useState<'account' | 'card'>(cardOptions.length && !accountOptions.length ? 'card' : 'account')
  const [account, setAccount] = useState(String(accountOptions[0]?.id ?? ''))
  const [card, setCard] = useState(String(cardOptions[0]?.id ?? ''))
  const [notes, setNotes] = useState('')
  const [errors, setErrors] = useState<FormErrors>({ fields: {}, message: null })
  const [submitting, setSubmitting] = useState(false)

  const parsed = parseMoneyInput(total)
  const n = Number(count)
  const valid = parsed !== null && Number(parsed) > 0 && Number.isInteger(n) && n >= 2 && n <= 120 && !!first
  const preview = useQuery({
    queryKey: ['plan-preview', parsed, n, first],
    queryFn: () => plansApi.preview({ total_amount: parsed as string, count: n, first_date: first }),
    enabled: valid,
    staleTime: 60_000,
  })

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (submitting) return
    const f: Record<string, string> = {}
    if (!description.trim()) f.description = 'Informe a descrição da compra.'
    if (parsed === null || Number(parsed) <= 0) f.total_amount = 'Informe o valor total, como 4.320,00.'
    if (!Number.isInteger(n) || n < 2 || n > 120) f.count = 'Use de 2 a 120 parcelas.'
    if (!category) f.category = 'Escolha a categoria.'
    if (via === 'account' && !account) f.account = 'Escolha a conta.'
    if (via === 'card' && !card) f.credit_card = 'Escolha o cartão.'
    if (Object.keys(f).length) return setErrors({ fields: f, message: null })

    setSubmitting(true)
    setErrors({ fields: {}, message: null })
    try {
      await onSubmit({
        description: description.trim(), total_amount: parsed as string, count: n, first_date: first, category: Number(category),
        account: via === 'account' ? Number(account) : null, credit_card: via === 'card' ? Number(card) : null, notes,
      })  // fmt: skip
    } catch (err) {
      setErrors(toFormErrors(err))
    } finally {
      setSubmitting(false)
    }
  }

  const rows = preview.data?.installments ?? []
  const shown = rows.length > 5 ? [...rows.slice(0, 3), null, ...rows.slice(-1)] : rows

  return (
    <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
      <Field label="Descrição da compra" error={errors.fields.description}>
        <input className={inputClass} value={description} onChange={(e) => setDescription(e.target.value)} maxLength={120} placeholder="Ex.: Celular, Geladeira" autoFocus />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Valor total (R$)" error={errors.fields.total_amount}>
          <input className={inputClass} inputMode="decimal" placeholder="0,00" value={total} onChange={(e) => setTotal(e.target.value)} />
        </Field>
        <Field label="Parcelas" error={errors.fields.count}>
          <input className={inputClass} inputMode="numeric" value={count} onChange={(e) => setCount(e.target.value)} />
        </Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Primeira parcela" error={errors.fields.first_date}>
          <input className={inputClass} type="date" value={first} onChange={(e) => setFirst(e.target.value)} />
        </Field>
        <Field label="Categoria" error={errors.fields.category}>
          <select className={inputClass} value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="">Selecione…</option>
            {expenseCategories.map((c) => (<option key={c.id} value={c.id}>{c.name}</option>))}
          </select>
        </Field>
      </div>

      <fieldset className="flex flex-col gap-3">
        <legend className="mb-1 text-sm font-medium">Forma de pagamento</legend>
        <div role="radiogroup" aria-label="Forma de pagamento" className="grid grid-cols-2 gap-1 rounded-lg border border-white/10 bg-marinho p-1">
          {(['account', 'card'] as const).map((v) => (
            <button key={v} type="button" role="radio" aria-checked={via === v} onClick={() => setVia(v)}
              className={cn('min-h-10 rounded-md px-2 text-sm', via === v ? 'bg-suave/25 font-medium' : 'text-cinza-t hover:text-branco')}>
              {v === 'account' ? 'Conta / boleto' : 'Cartão de crédito'}
            </button>
          ))}
        </div>
        {via === 'account' ? (
          <Field label="Conta" error={errors.fields.account}>
            <select className={inputClass} value={account} onChange={(e) => setAccount(e.target.value)}>
              {accountOptions.length === 0 && <option value="">Nenhuma conta cadastrada</option>}
              {accountOptions.map((a) => (<option key={a.id} value={a.id}>{a.name}</option>))}
            </select>
          </Field>
        ) : (
          <Field label="Cartão" error={errors.fields.credit_card}>
            <select className={inputClass} value={card} onChange={(e) => setCard(e.target.value)}>
              {cardOptions.length === 0 && <option value="">Nenhum cartão cadastrado</option>}
              {cardOptions.map((c) => (<option key={c.id} value={c.id}>{c.name}</option>))}
            </select>
          </Field>
        )}
      </fieldset>

      <div aria-live="polite" className="rounded-lg border border-white/10 p-3 text-sm">
        <p className="mb-1 text-xs font-medium text-cinza-t">Prévia das parcelas</p>
        {!valid ? (
          <p className="text-cinza-t">Informe valor, parcelas e data para ver como ficam.</p>
        ) : preview.isPending ? (
          <p className="text-cinza-t">Calculando…</p>
        ) : preview.isError ? (
          <p className="text-queimado-t">Não foi possível calcular a prévia.</p>
        ) : (
          <>
            <ul className="space-y-0.5">
              {shown.map((r, i) =>
                r === null ? (
                  <li key={`gap-${i}`} className="text-center text-cinza-t">⋯</li>
                ) : (
                  <li key={r.number} className="flex justify-between tabular-nums">
                    <span>{r.number}ª · {formatDate(r.date)}</span>
                    <span>{formatBRL(r.amount)}</span>
                  </li>
                ),
              )}
            </ul>
            <p className="mt-2 flex justify-between border-t border-white/10 pt-2 font-medium tabular-nums">
              <span>Total das parcelas</span>
              <span>{formatBRL(preview.data.total)}</span>
            </p>
          </>
        )}
      </div>

      <Field label="Observações">
        <textarea className={cn(inputClass, 'min-h-16 py-2')} value={notes} onChange={(e) => setNotes(e.target.value)} />
      </Field>
      {errors.message && <FormMessage>{errors.message}</FormMessage>}
      <div className="flex justify-end gap-3 pt-2">
        <Button variant="secondary" onClick={onCancel}>Cancelar</Button>
        <Button type="submit" disabled={submitting}>{submitting ? 'Gerando parcelas…' : 'Criar parcelamento'}</Button>
      </div>
    </form>
  )
}
