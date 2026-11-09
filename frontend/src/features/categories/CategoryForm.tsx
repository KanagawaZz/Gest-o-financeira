import { useState, type FormEvent } from 'react'
import { Button } from '@/components/ui/Button'
import { Field, FormMessage, inputClass } from '@/components/ui/Field'
import { toFormErrors, type FormErrors } from '@/lib/errors'
import type { Category, CategoryInput, CategoryKind } from '@/types/finance'

export function CategoryForm({
  category,
  defaultKind,
  onSubmit,
  onCancel,
}: {
  category?: Category
  defaultKind: CategoryKind
  onSubmit: (input: CategoryInput) => Promise<void>
  onCancel: () => void
}) {
  const [name, setName] = useState(category?.name ?? '')
  const [kind, setKind] = useState<CategoryKind>(category?.kind ?? defaultKind)
  const [color, setColor] = useState(category?.color ?? '#6D91B5')
  const [errors, setErrors] = useState<FormErrors>({ fields: {}, message: null })
  const [submitting, setSubmitting] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (submitting) return
    if (!name.trim()) return setErrors({ fields: { name: 'Informe o nome.' }, message: null })
    setSubmitting(true)
    setErrors({ fields: {}, message: null })
    try {
      await onSubmit({ name: name.trim(), kind, color })
    } catch (err) {
      setErrors(toFormErrors(err)) // mantém o que foi digitado
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
      <Field label="Nome" error={errors.fields.name}>
        <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} maxLength={60} autoFocus />
      </Field>
      <Field label="Tipo" error={errors.fields.kind}>
        <select className={inputClass} value={kind} onChange={(e) => setKind(e.target.value as CategoryKind)} disabled={!!category}>
          <option value="expense">Despesa</option>
          <option value="income">Receita</option>
        </select>
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
