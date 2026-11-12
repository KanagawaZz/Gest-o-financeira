import { useQueryClient } from '@tanstack/react-query'
import { Download, Trash2 } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Field, FormMessage, inputClass } from '@/components/ui/Field'
import { Modal } from '@/components/ui/Modal'
import { toFormErrors, type FormErrors } from '@/lib/errors'
import { settingsApi } from '@/services/planning'
import { useAuth } from '../auth/AuthProvider'
import { setHidden } from '../onboarding/steps'

const NONE: FormErrors = { fields: {}, message: null }
// Mesmo padrão visual das mensagens de erro (fundo suave + texto claro): contraste AA nos dois temas.
// O "!" garante que valem sobre as cores da variante do botão.
const dangerButton = '!border-queimado/50 !bg-queimado/15 !text-queimado-t font-semibold hover:!bg-queimado/25'

/**
 * Exclusão da própria conta (direito de eliminação, LGPD). É definitiva: o servidor apaga o usuário e
 * todos os dados dele. Por isso pede a senha, explica o que será apagado e oferece a exportação antes.
 */
export function DeleteAccountCard() {
  const { user } = useAuth()
  const qc = useQueryClient()
  const [open, setOpen] = useState(false)
  const [password, setPassword] = useState('')
  const [errors, setErrors] = useState<FormErrors>(NONE)
  const [busy, setBusy] = useState(false)

  function close() {
    if (busy) return
    setOpen(false)
    setPassword('')
    setErrors(NONE)
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (busy || !password) return
    setBusy(true)
    setErrors(NONE)
    try {
      await settingsApi.deleteAccount(password)
      if (user) setHidden(user.id, false) // não deixa preferência de um usuário que não existe mais
      qc.clear() // nenhum dado financeiro fica em memória
      // Mesmo caminho de uma sessão encerrada: o AuthProvider zera o usuário e a rota protegida leva ao login.
      window.dispatchEvent(new Event('nexo:unauthorized'))
    } catch (err) {
      setErrors(toFormErrors(err))
      setBusy(false)
    }
  }

  return (
    <Card className="!border-queimado/30 p-4 sm:p-5">
      <h2 className="text-base font-medium">Excluir conta</h2>
      <p className="mt-1 text-sm text-cinza-t">
        Apaga seu usuário e todos os seus dados do NEXO, de forma definitiva. Não é possível desfazer.
      </p>
      <Button variant="secondary" className={`mt-4 ${dangerButton}`} onClick={() => setOpen(true)}>
        <Trash2 aria-hidden className="size-4" /> Excluir minha conta
      </Button>

      <Modal open={open} title="Excluir minha conta" onClose={close}>
        <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
          <div className="text-sm text-cinza-t">
            <p>Ao confirmar, serão apagados para sempre:</p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>seu usuário e seu acesso ao NEXO;</li>
              <li>contas, lançamentos, compromissos e parcelamentos;</li>
              <li>cartões, faturas, metas, categorias e o histórico de alterações.</li>
            </ul>
            <p className="mt-3">Ninguém, nem o suporte, consegue recuperar esses dados depois.</p>
          </div>
          <a href={settingsApi.exportUrl} download className="inline-flex min-h-10 items-center gap-2 self-start rounded-xl chip px-4 text-sm">
            <Download aria-hidden className="size-4" /> Baixar uma cópia antes
          </a>
          <Field label="Digite sua senha para confirmar" error={errors.fields.password}>
            <input className={inputClass} type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </Field>
          {errors.message && <FormMessage>{errors.message}</FormMessage>}
          <div className="flex flex-wrap justify-end gap-3">
            <Button variant="secondary" onClick={close} disabled={busy}>
              Cancelar
            </Button>
            <Button type="submit" variant="secondary" className={dangerButton} disabled={busy || !password}>
              {busy ? 'Excluindo…' : 'Excluir definitivamente'}
            </Button>
          </div>
        </form>
      </Modal>
    </Card>
  )
}
