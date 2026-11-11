import { useEffect, useState, type FormEvent } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { Backdrop } from '@/app/layouts/Backdrop'
import { LogoMark } from '@/components/brand/Logo'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { ApiError } from '@/services/api'
import { authService } from '@/services/auth'
import { useAuth } from './AuthProvider'

export function RegisterPage() {
  const { user, register } = useAuth()
  const [firstName, setFirstName] = useState('')
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)
  const [registrationEnabled, setRegistrationEnabled] = useState<boolean | null>(null)

  useEffect(() => {
    let active = true
    authService
      .registrationStatus()
      .then((res) => {
        if (active) setRegistrationEnabled(res.enabled)
      })
      .catch(() => {
        if (active) setRegistrationEnabled(true) // assume habilitado se não obtiver resposta
      })
    return () => {
      active = false
    }
  }, [])

  if (user) return <Navigate to="/" replace />

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (submitting) return
    setError(null)
    setFieldErrors({})

    if (password !== passwordConfirm) {
      setFieldErrors({ passwordConfirm: 'As senhas não coincidem.' })
      return
    }

    if (password.length < 10) {
      setFieldErrors({ password: 'A senha deve conter no mínimo 10 caracteres.' })
      return
    }

    setSubmitting(true)
    try {
      await register({
        username: username.trim(),
        first_name: firstName.trim(),
        email: email.trim() || undefined,
        password,
      })
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.details && typeof err.details === 'object') {
          const mapped: Record<string, string> = {}
          for (const [k, v] of Object.entries(err.details)) {
            mapped[k] = Array.isArray(v) ? (v[0] ? String(v[0]) : '') : String(v)
          }
          setFieldErrors(mapped)
        }
        setError(err.message || 'Não foi possível concluir o cadastro.')
      } else {
        setError('Ocorreu um erro inesperado. Tente novamente.')
      }
    } finally {
      setSubmitting(false)
    }
  }

  const field =
    'mt-1.5 min-h-12 w-full rounded-xl glass-field border border-linha/12 px-3.5 text-[15px] text-branco placeholder:text-cinza-t/70 focus:border-suave'

  return (
    <div className="login-page photo-text relative flex min-h-full items-center justify-center overflow-hidden px-4 py-10">
      <Backdrop />
      <div className="relative w-full max-w-sm">
        <div className="login-heading mb-6 flex flex-col items-center text-center">
          <LogoMark className="size-14" />
          <h1 className="mt-3 text-4xl font-bold tracking-wide">NEXO</h1>
          <p className="mt-1 text-base text-branco">Crie sua conta e organize suas finanças com clareza.</p>
        </div>

        {registrationEnabled === false ? (
          <Card className="p-6 text-center">
            <h2 className="text-lg font-semibold text-branco">Novos cadastros suspensos</h2>
            <p className="mt-2 text-sm text-cinza-t">
              A criação de novas contas está temporariamente desabilitada pelo administrador do sistema.
            </p>
            <Link to="/login" className="mt-6 inline-block w-full">
              <Button variant="secondary" className="w-full min-h-12">
                Voltar para o login
              </Button>
            </Link>
          </Card>
        ) : (
          <Card className="p-6">
            <form onSubmit={onSubmit} className="flex flex-col gap-3.5" noValidate>
              <label className="text-sm font-medium">
                Nome ou como quer ser chamado
                <input
                  className={field}
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="Ex: Carlos Silva"
                  autoComplete="name"
                  autoFocus
                />
              </label>

              <label className="text-sm font-medium">
                Nome de usuário <span className="text-queimado-t">*</span>
                <input
                  className={field}
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="usuario"
                  autoComplete="username"
                  required
                />
                {fieldErrors.username && (
                  <p className="mt-1 text-xs text-queimado-t">{fieldErrors.username}</p>
                )}
              </label>

              <label className="text-sm font-medium">
                E-mail (opcional)
                <input
                  className={field}
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="seu@email.com"
                  autoComplete="email"
                />
                {fieldErrors.email && (
                  <p className="mt-1 text-xs text-queimado-t">{fieldErrors.email}</p>
                )}
              </label>

              <label className="text-sm font-medium">
                Senha (mínimo 10 caracteres) <span className="text-queimado-t">*</span>
                <input
                  className={field}
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="new-password"
                  required
                />
                {fieldErrors.password && (
                  <p className="mt-1 text-xs text-queimado-t">{fieldErrors.password}</p>
                )}
              </label>

              <label className="text-sm font-medium">
                Confirmar senha <span className="text-queimado-t">*</span>
                <input
                  className={field}
                  type="password"
                  value={passwordConfirm}
                  onChange={(e) => setPasswordConfirm(e.target.value)}
                  autoComplete="new-password"
                  required
                />
                {fieldErrors.passwordConfirm && (
                  <p className="mt-1 text-xs text-queimado-t">{fieldErrors.passwordConfirm}</p>
                )}
              </label>

              {error && (
                <p role="alert" className="rounded-xl border border-queimado/30 bg-queimado/12 px-3 py-2 text-sm text-queimado-t">
                  {error}
                </p>
              )}

              <Button
                type="submit"
                className="mt-2 min-h-12 text-[15px]"
                disabled={submitting || !username.trim() || !password || !passwordConfirm}
              >
                {submitting ? 'Criando conta…' : 'Criar minha conta'}
              </Button>

              <div className="mt-2 text-center text-sm text-cinza-t">
                Já possui uma conta?{' '}
                <Link to="/login" className="font-semibold text-esmeralda hover:underline">
                  Entrar
                </Link>
              </div>
            </form>
          </Card>
        )}
      </div>
    </div>
  )
}
