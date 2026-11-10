import { useState, type CSSProperties, type FormEvent } from 'react'
import { Navigate } from 'react-router-dom'
import heroUrl from '@/assets/hero-cidade.webp'
import { LogoMark } from '@/components/brand/Logo'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { ApiError } from '@/services/api'
import { useAuth } from './AuthProvider'

export function LoginPage() {
  const { user, login } = useAuth()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  if (user) return <Navigate to="/" replace />

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (submitting) return // evita envio duplicado
    setSubmitting(true)
    setError(null)
    try {
      await login(username, password)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível entrar. Tente novamente.')
    } finally {
      setSubmitting(false)
    }
  }

  const field =
    'mt-1.5 min-h-12 w-full rounded-xl glass-field border border-white/12 px-3.5 text-[15px] text-branco placeholder:text-cinza-t/70 focus:border-suave'

  return (
    <div className="relative flex min-h-full items-center justify-center overflow-hidden px-4 py-10">
      <div aria-hidden className="login-backdrop absolute inset-0" style={{ '--hero-image': `url("${heroUrl}")` } as CSSProperties} />
      <div className="relative w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <LogoMark className="size-14" />
          <h1 className="mt-3 text-4xl font-bold tracking-wide">NEXO</h1>
          <p className="mt-1 text-base text-branco/85">Seu controle financeiro, com mais tranquilidade.</p>
        </div>
        <Card className="p-6">
          <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
            <label className="text-sm font-medium">
              Usuário
              <input
                className={field}
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
                autoFocus
                required
              />
            </label>
            <label className="text-sm font-medium">
              Senha
              <input
                className={field}
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
              />
            </label>
            {error && (
              <p role="alert" className="rounded-xl border border-queimado/30 bg-queimado/12 px-3 py-2 text-sm text-queimado-t">
                {error}
              </p>
            )}
            <Button type="submit" className="mt-1 min-h-12 text-[15px]" disabled={submitting || !username || !password}>
              {submitting ? 'Entrando…' : 'Entrar'}
            </Button>
          </form>
        </Card>
      </div>
    </div>
  )
}
