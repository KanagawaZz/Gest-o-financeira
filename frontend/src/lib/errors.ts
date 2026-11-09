import { ApiError } from '@/services/api'

export type FormErrors = { fields: Record<string, string>; message: string | null }

/** Separa o erro da API em mensagens por campo e uma mensagem geral. */
export function toFormErrors(err: unknown): FormErrors {
  if (!(err instanceof ApiError)) return { fields: {}, message: 'Não foi possível concluir a operação. Tente novamente.' }
  const fields: Record<string, string> = {}
  let general: string[] = []
  for (const [key, value] of Object.entries(err.details ?? {})) {
    const msg = Array.isArray(value) ? value.join(' ') : String(value)
    if (key === 'non_field_errors') general.push(msg)
    else fields[key] = msg
  }
  if (!Object.keys(fields).length && !general.length) general = [err.message]
  return { fields, message: general.join(' ') || null }
}
