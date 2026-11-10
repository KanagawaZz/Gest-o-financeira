import { Download, LogOut, ShieldCheck } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Field, FormMessage, inputClass } from '@/components/ui/Field'
import { PageHeader } from '@/components/ui/PageHeader'
import { useToast } from '@/components/ui/Toast'
import { toFormErrors, type FormErrors } from '@/lib/errors'
import { settingsApi } from '@/services/planning'
import { useAuth } from '../auth/AuthProvider'
import { ThemeCard } from './ThemeCard'

const NONE: FormErrors = { fields: {}, message: null }

function ProfileCard() {
  const { user, refreshUser } = useAuth()
  const toast = useToast()
  const [name, setName] = useState(user?.first_name ?? '')
  const [email, setEmail] = useState(user?.email ?? '')
  const [errors, setErrors] = useState<FormErrors>(NONE)
  const [busy, setBusy] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (busy) return
    setBusy(true)
    setErrors(NONE)
    try {
      await settingsApi.updateProfile({ first_name: name.trim(), email: email.trim() })
      await refreshUser()
      toast.success('Perfil atualizado.')
    } catch (err) {
      setErrors(toFormErrors(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card>
      <h2 className="text-base font-medium">Perfil</h2>
      <form onSubmit={submit} className="mt-4 flex flex-col gap-4" noValidate>
        <Field label="Usuário" hint="O nome de usuário não pode ser alterado."><input className={inputClass} value={user?.username ?? ''} disabled /></Field>
        <Field label="Nome" error={errors.fields.first_name}><input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} maxLength={60} /></Field>
        <Field label="E-mail" error={errors.fields.email}><input className={inputClass} type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
        {errors.message && <FormMessage>{errors.message}</FormMessage>}
        <div><Button type="submit" disabled={busy}>{busy ? 'Salvando…' : 'Salvar perfil'}</Button></div>
      </form>
    </Card>
  )
}

function PasswordCard() {
  const toast = useToast()
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [errors, setErrors] = useState<FormErrors>(NONE)
  const [busy, setBusy] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (busy) return
    if (next !== confirm) return setErrors({ fields: { confirm: 'As senhas não coincidem.' }, message: null })
    setBusy(true)
    setErrors(NONE)
    try {
      await settingsApi.changePassword({ current_password: current, new_password: next })
      setCurrent('')
      setNext('')
      setConfirm('')
      toast.success('Senha alterada. Outras sessões foram encerradas.')
    } catch (err) {
      setErrors(toFormErrors(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card>
      <h2 className="flex items-center gap-2 text-base font-medium"><ShieldCheck aria-hidden className="size-5 text-suave-t" /> Segurança</h2>
      <form onSubmit={submit} className="mt-4 flex flex-col gap-4" noValidate>
        <Field label="Senha atual" error={errors.fields.current_password}><input className={inputClass} type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} /></Field>
        <Field label="Nova senha" error={errors.fields.new_password} hint="Mínimo de 10 caracteres, sem ser comum nem só números."><input className={inputClass} type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} /></Field>
        <Field label="Confirmar nova senha" error={errors.fields.confirm}><input className={inputClass} type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} /></Field>
        {errors.message && <FormMessage>{errors.message}</FormMessage>}
        <div><Button type="submit" disabled={busy || !current || !next}>{busy ? 'Alterando…' : 'Alterar senha'}</Button></div>
      </form>
    </Card>
  )
}

export function SettingsPage() {
  const { logout } = useAuth()
  return (
    <section>
      <PageHeader title="Configurações" subtitle="Perfil, segurança e seus dados." />
      <div className="grid gap-6 lg:grid-cols-2">
        <ProfileCard />
        <PasswordCard />
        <Card>
          <h2 className="text-base font-medium">Seus dados</h2>
          <p className="mt-1 text-sm text-cinza-t">Baixe uma cópia completa (contas, categorias, lançamentos, regras, cartões, parcelamentos, metas e histórico) em JSON. Guarde em local seguro: o arquivo não é criptografado.</p>
          <a href={settingsApi.exportUrl} download className="mt-4 inline-flex min-h-10 items-center gap-2 rounded-xl chip px-4 text-sm"><Download aria-hidden className="size-4" /> Exportar meus dados</a>
          <p className="mt-4 text-xs text-cinza-t">Relatórios em CSV e PDF ficam na tela de Relatórios. Backup do banco e restauração são feitos no servidor (veja o README).</p>
        </Card>
        <ThemeCard />
        <Card>
          <h2 className="text-base font-medium">Preferências</h2>
          <dl className="mt-3 space-y-2 text-sm">
            <div className="flex justify-between"><dt className="text-cinza-t">Moeda</dt><dd>Real (BRL)</dd></div>
            <div className="flex justify-between"><dt className="text-cinza-t">Fuso horário</dt><dd>America/Cuiaba</dd></div>
            <div className="flex justify-between"><dt className="text-cinza-t">Formato de data</dt><dd>dd/mm/aaaa</dd></div>
          </dl>
          <Button variant="secondary" className="mt-5" onClick={() => void logout()}><LogOut aria-hidden className="size-4" /> Sair do NEXO</Button>
        </Card>
      </div>
    </section>
  )
}
