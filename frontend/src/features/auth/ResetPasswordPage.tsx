import { useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Backdrop } from '@/app/layouts/Backdrop'
import { LogoMark } from '@/components/brand/Logo'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { ApiError } from '@/services/api'
import { authService } from '@/services/auth'

export function ResetPasswordPage() {
  const [searchParams] = useSearchParams()
  const uid = searchParams.get('uid') || ''
  const token = searchParams.get('token') || ''

  const [password, setPassword] = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const isLinkInvalid = !uid || !token

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (submitting || isLinkInvalid) return
    setError(null)
    setFieldErrors({})

    if (password !== passwordConfirm) {
      setFieldErrors({ passwordConfirm: 'As senhas não coincidem.' })
      return
    }

    if (password.length < 10) {
      setFieldErrors({ password: 'A nova senha deve ter no mínimo 10 caracteres.' })
      return
    }

    setSubmitting(true)
    try {
      await authService.confirmPasswordReset({
        uid,
        token,
        new_password: password,
      })
      setSuccess(true)
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.details && typeof err.details === 'object') {
          const mapped: Record<string, string> = {}
          for (const [k, v] of Object.entries(err.details)) {
            mapped[k] = Array.isArray(v) ? (v[0] ? String(v[0]) : '') : String(v)
          }
          setFieldErrors(mapped)
        }
        setError(err.message || 'Não foi possível redefinir a senha.')
      } else {
        setError('Ocorreu um erro ao processar a solicitação. Tente novamente.')
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
          <p className="mt-1 text-base text-branco">Redefinição de senha</p>
        </div>

        <Card className="p-6">
          {success ? (
            <div className="flex flex-col gap-4 text-center">
              <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-salvia/20 text-salvia-t">
                ✓
              </div>
              <h2 className="text-lg font-semibold text-branco">Senha alterada com sucesso!</h2>
              <p className="text-sm text-cinza-t">
                Sua senha foi redefinida com segurança. Você já pode entrar na sua conta com a nova senha.
              </p>
              <Link to="/login" className="mt-2 inline-block w-full">
                <Button className="w-full min-h-12 text-[15px]">
                  Ir para o login
                </Button>
              </Link>
            </div>
          ) : isLinkInvalid ? (
            <div className="flex flex-col gap-4 text-center">
              <h2 className="text-lg font-semibold text-queimado-t">Link inválido ou expirado</h2>
              <p className="text-sm text-cinza-t">
                O link de redefinição de senha está incompleto, incorreto ou já expirou.
              </p>
              <Link to="/recuperar-senha" className="mt-2 inline-block w-full">
                <Button variant="secondary" className="w-full min-h-12 text-[15px]">
                  Solicitar novo link
                </Button>
              </Link>
            </div>
          ) : (
            <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
              <label className="text-sm font-medium">
                Nova senha (mínimo 10 caracteres)
                <input
                  className={field}
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="new-password"
                  autoFocus
                  required
                />
                {fieldErrors.new_password && (
                  <p className="mt-1 text-xs text-queimado-t">{fieldErrors.new_password}</p>
                )}
                {fieldErrors.password && (
                  <p className="mt-1 text-xs text-queimado-t">{fieldErrors.password}</p>
                )}
              </label>

              <label className="text-sm font-medium">
                Confirmar nova senha
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
                className="mt-1 min-h-12 text-[15px]"
                disabled={submitting || !password || !passwordConfirm}
              >
                {submitting ? 'Salvando nova senha…' : 'Salvar nova senha'}
              </Button>

              <div className="mt-2 text-center text-sm text-cinza-t">
                <Link to="/login" className="font-semibold text-esmeralda hover:underline">
                  Voltar ao login
                </Link>
              </div>
            </form>
          )}
        </Card>
      </div>
    </div>
  )
}

