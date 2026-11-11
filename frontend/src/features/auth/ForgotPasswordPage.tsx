import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { Backdrop } from '@/app/layouts/Backdrop'
import { LogoMark } from '@/components/brand/Logo'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { ApiError } from '@/services/api'
import { authService } from '@/services/auth'

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (submitting) return
    setSubmitting(true)
    setError(null)
    try {
      await authService.requestPasswordReset(email.trim())
      setSent(true)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível solicitar a recuperação. Tente novamente.')
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
          <p className="mt-1 text-base text-branco">Recuperação de acesso</p>
        </div>

        <Card className="p-6">
          {sent ? (
            <div className="flex flex-col gap-4 text-center">
              <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-salvia/20 text-salvia-t">
                ✓
              </div>
              <h2 className="text-lg font-semibold text-branco">Instruções enviadas!</h2>
              <p className="text-sm text-cinza-t">
                Se o e-mail <strong className="text-branco">{email}</strong> estiver cadastrado, enviamos as instruções
                e o link para criar uma nova senha.
              </p>
              <p className="text-xs text-cinza-t/80">
                Não encontrou? Verifique também a sua caixa de spam ou lixo eletrônico.
              </p>
              <Link to="/login" className="mt-2 inline-block w-full">
                <Button className="w-full min-h-12 text-[15px]">
                  Voltar para o login
                </Button>
              </Link>
            </div>
          ) : (
            <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
              <p className="text-sm text-cinza-t">
                Digite o e-mail cadastrado na sua conta. Enviaremos um link seguro para você redefinir sua senha.
              </p>

              <label className="text-sm font-medium">
                E-mail cadastrado
                <input
                  className={field}
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="seu@email.com"
                  autoComplete="email"
                  autoFocus
                  required
                />
              </label>

              {error && (
                <p role="alert" className="rounded-xl border border-queimado/30 bg-queimado/12 px-3 py-2 text-sm text-queimado-t">
                  {error}
                </p>
              )}

              <Button
                type="submit"
                className="mt-1 min-h-12 text-[15px]"
                disabled={submitting || !email.trim()}
              >
                {submitting ? 'Enviando instruções…' : 'Enviar link de recuperação'}
              </Button>

              <div className="mt-2 text-center text-sm text-cinza-t">
                Lembrou sua senha?{' '}
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

