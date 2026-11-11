export type ApiErrorBody = {
  error: { code: string; message: string; details: Record<string, string[]> | null }
}

export class ApiError extends Error {
  readonly status: number
  readonly code: string
  readonly details: Record<string, string[]> | null

  constructor(status: number, code: string, message: string, details: Record<string, string[]> | null) {
    super(message)
    this.status = status
    this.code = code
    this.details = details
  }
}

const BASE = '/api/v1'

function readCookie(name: string): string | undefined {
  return document.cookie
    .split('; ')
    .find((c) => c.startsWith(`${name}=`))
    ?.slice(name.length + 1)
}

async function ensureCsrf(): Promise<string> {
  let token = readCookie('csrftoken')
  if (!token) {
    await fetch(`${BASE}/auth/csrf/`, { credentials: 'same-origin' })
    token = readCookie('csrftoken')
  }
  return token ?? ''
}

export async function api<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const method = init.method ?? 'GET'
  const headers: Record<string, string> = { Accept: 'application/json' }
  if (init.body !== undefined) headers['Content-Type'] = 'application/json'
  if (method !== 'GET') headers['X-CSRFToken'] = await ensureCsrf()

  let res: Response
  try {
    res = await fetch(`${BASE}${path}`, {
      method,
      headers,
      credentials: 'same-origin',
      body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
    })
  } catch {
    throw new ApiError(0, 'network_error', 'Sem conexão com o servidor. Verifique sua internet e tente novamente.', null)
  }

  if (res.status === 204) return undefined as T
  const data: unknown = await res.json().catch(() => null)
  if (!res.ok) {
    const err = (data as ApiErrorBody | null)?.error
    const code = err?.code ?? 'error'
    if (
      (res.status === 401 || res.status === 403) &&
      (code === 'not_authenticated' || code === 'authentication_failed') &&
      !path.startsWith('/auth/')
    ) {
      window.dispatchEvent(new CustomEvent('nexo:unauthorized'))
    }
    throw new ApiError(res.status, code, err?.message ?? 'Não foi possível concluir a operação.', err?.details ?? null)
  }
  return data as T
}
