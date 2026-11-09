import { useState, type FormEvent } from 'react'
import { Navigate } from 'react-router-dom'
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
    'mt-1.5 min-h-11 w-full rounded-lg border border-white/12 bg-marinho px-3 text-sm text-branco placeholder:text-cinza-t/70 focus:border-suave'

  return (
    <div className="flex min-h-full items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-semibold tracking-wide">NEXO</h1>
          <p className="mt-1 text-sm text-cinza-t">Seu controle financeiro, com mais tranquilidade.</p>
        </div>
        <Card>
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
              <p role="alert" className="rounded-lg bg-queimado/15 px-3 py-2 text-sm text-queimado-t">
                {error}
              </p>
            )}
            <Button type="submit" disabled={submitting || !username || !password}>
              {submitting ? 'Entrando…' : 'Entrar'}
            </Button>
          </form>
        </Card>
      </div>
    </div>
  )
}
