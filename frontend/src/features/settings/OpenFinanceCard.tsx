import { Landmark, Lock, RefreshCw, Trash2, Unplug } from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Field, FormMessage, inputClass } from '@/components/ui/Field'
import { useToast } from '@/components/ui/Toast'
import { toFormErrors, type FormErrors } from '@/lib/errors'
import { pluggyApi, type PluggyStatus } from '@/services/planning'

const NONE: FormErrors = { fields: {}, message: null }

function formatDateTime(iso: string | null): string {
  if (!iso) return 'Nunca sincronizado'
  try {
    return new Date(iso).toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return iso
  }
}

export function OpenFinanceCard() {
  const toast = useToast()
  const [status, setStatus] = useState<PluggyStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [clientId, setClientId] = useState('')
  const [clientSecret, setClientSecret] = useState('')
  const [itemIds, setItemIds] = useState('')
  const [errors, setErrors] = useState<FormErrors>(NONE)
  const [busy, setBusy] = useState(false)
  const [syncing, setSyncing] = useState(false)

  useEffect(() => {
    let active = true
    pluggyApi
      .getStatus()
      .then((s) => {
        if (active) setStatus(s)
      })
      .catch(() => {
        // Silencia erro inicial se desconectado
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [])

  async function handleSave(e: FormEvent) {
    e.preventDefault()
    if (busy) return
    setBusy(true)
    setErrors(NONE)
    try {
      const updated = await pluggyApi.saveCredentials({
        client_id: clientId.trim(),
        client_secret: clientSecret.trim(),
        item_ids: itemIds.trim(),
        sync_now: true,
      })
      setStatus(updated)
      setClientId('')
      setClientSecret('')
      setItemIds('')
      setEditing(false)
      toast.success('Open Finance conectado e sincronizado com sucesso!')
    } catch (err) {
      setErrors(toFormErrors(err))
    } finally {
      setBusy(false)
    }
  }

  async function handleSyncNow() {
    if (syncing) return
    setSyncing(true)
    setErrors(NONE)
    try {
      const updated = await pluggyApi.syncNow()
      setStatus(updated)
      const count = updated.sync_result?.created_transactions ?? updated.last_synced_count
      toast.success(`Sincronização concluída (${count} novo(s) lançamento(s)).`)
    } catch (err) {
      setErrors(toFormErrors(err))
    } finally {
      setSyncing(false)
    }
  }

  async function handleDisconnect() {
    if (busy) return
    if (!window.confirm('Remover as credenciais do Meu Pluggy? Os lançamentos já importados serão mantidos.')) return
    setBusy(true)
    setErrors(NONE)
    try {
      const updated = await pluggyApi.disconnect()
      setStatus(updated)
      setEditing(false)
      toast.success('Credenciais do Open Finance removidas.')
    } catch (err) {
      setErrors(toFormErrors(err))
    } finally {
      setBusy(false)
    }
  }

  const isConnected = Boolean(status?.is_connected)
  const showForm = !isConnected || editing

  return (
    <Card className="lg:col-span-2">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-base font-medium">
            <Landmark aria-hidden className="size-5 text-suave-t" /> Integração Bancária — Open Finance (Meu Pluggy)
          </h2>
          <p className="mt-1 text-sm text-cinza-t">
            Importe automaticamente contas, cartões e transações reais a cada 6 horas com criptografia autenticada AES-256-GCM.
          </p>
        </div>
        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${
            isConnected ? 'bg-emerald-500/15 text-emerald-300' : 'chip text-cinza-t'
          }`}
        >
          <Lock aria-hidden className="size-3.5" />
          {isConnected ? 'Conectado (AES-256-GCM)' : 'Não configurado'}
        </span>
      </div>

      {loading ? (
        <p className="mt-4 text-sm text-cinza-t">Verificando status da integração…</p>
      ) : (
        <>
          {isConnected && status && !editing && (
            <div className="mt-4 rounded-xl border border-white/10 bg-white/5 p-4 text-sm">
              <dl className="grid gap-3 sm:grid-cols-3">
                <div>
                  <dt className="text-xs text-cinza-t">Client ID (mascarado)</dt>
                  <dd className="mt-0.5 font-mono text-sm">{status.client_id_masked}</dd>
                </div>
                <div>
                  <dt className="text-xs text-cinza-t">Itens conectados ({status.item_count})</dt>
                  <dd className="mt-0.5 font-mono text-sm">{status.item_ids_masked || '—'}</dd>
                </div>
                <div>
                  <dt className="text-xs text-cinza-t">Última sincronização</dt>
                  <dd className="mt-0.5 text-sm">{formatDateTime(status.last_sync_at)}</dd>
                </div>
              </dl>
              {status.last_sync_message && (
                <p
                  className={`mt-3 text-xs ${
                    status.last_sync_status === 'error' ? 'text-rose-300' : 'text-cinza-t'
                  }`}
                >
                  {status.last_sync_message}
                </p>
              )}
              {errors.message && <div className="mt-3"><FormMessage>{errors.message}</FormMessage></div>}
              <div className="mt-4 flex flex-wrap gap-2">
                <Button type="button" onClick={() => void handleSyncNow()} disabled={syncing || busy}>
                  <RefreshCw aria-hidden className={`size-4 ${syncing ? 'animate-spin' : ''}`} />
                  {syncing ? 'Sincronizando…' : 'Sincronizar agora'}
                </Button>
                <Button type="button" variant="secondary" onClick={() => setEditing(true)} disabled={syncing || busy}>
                  Atualizar chaves
                </Button>
                <Button type="button" variant="secondary" onClick={() => void handleDisconnect()} disabled={syncing || busy}>
                  <Trash2 aria-hidden className="size-4" /> Desconectar
                </Button>
              </div>
            </div>
          )}

          {showForm && (
            <div className="mt-4 grid gap-6 lg:grid-cols-5">
              <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-xs leading-relaxed text-cinza-t lg:col-span-2">
                <p className="font-medium text-white/90">Como obter suas chaves gratuitas:</p>
                <ol className="mt-2 list-decimal space-y-1.5 pl-4">
                  <li>
                    Crie sua conta pessoal em{' '}
                    <a
                      href="https://meu.pluggy.ai"
                      target="_blank"
                      rel="noreferrer"
                      className="underline hover:text-white"
                    >
                      meu.pluggy.ai
                    </a>{' '}
                    e conecte seu banco via Open Finance.
                  </li>
                  <li>
                    Acesse{' '}
                    <a
                      href="https://dashboard.pluggy.ai"
                      target="_blank"
                      rel="noreferrer"
                      className="underline hover:text-white"
                    >
                      dashboard.pluggy.ai
                    </a>
                    , vá em <strong>Aplicações</strong> e copie seu <strong>Client ID</strong> e{' '}
                    <strong>Client Secret</strong>.
                  </li>
                  <li>
                    Clique em <strong>Iniciar Demo</strong> na sua aplicação, conecte o item e copie o{' '}
                    <strong>Item ID</strong> (código UUID exibido acima do nome do banco).
                  </li>
                </ol>
              </div>

              <form onSubmit={handleSave} className="flex flex-col gap-4 lg:col-span-3" noValidate>
                <Field
                  label="Client ID"
                  error={errors.fields.client_id}
                  hint="Formato UUID (ex: 036bfa8e-3bd8-446d-aacd-4dbc38c46b75)"
                >
                  <input
                    className={inputClass}
                    value={clientId}
                    onChange={(e) => setClientId(e.target.value)}
                    placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                    autoComplete="off"
                    spellCheck={false}
                  />
                </Field>

                <Field
                  label="Client Secret"
                  error={errors.fields.client_secret}
                  hint="Criptografado com AES-256-GCM antes de salvar. Nunca fica visível após salvo."
                >
                  <input
                    className={inputClass}
                    type="password"
                    value={clientSecret}
                    onChange={(e) => setClientSecret(e.target.value)}
                    placeholder="••••••••••••••••••••••••••••••••"
                    autoComplete="new-password"
                  />
                </Field>

                <Field
                  label="Item ID(s) Conectado(s)"
                  error={errors.fields.item_ids}
                  hint="UUID da conexão bancária (se tiver mais de um banco, separe por vírgula)."
                >
                  <input
                    className={inputClass}
                    value={itemIds}
                    onChange={(e) => setItemIds(e.target.value)}
                    placeholder="4fa72a95-198f-4345-a4e3-b676459e0d6e"
                    autoComplete="off"
                    spellCheck={false}
                  />
                </Field>

                {errors.message && <FormMessage>{errors.message}</FormMessage>}

                <div className="flex flex-wrap gap-2">
                  <Button type="submit" disabled={busy || !clientId.trim() || !clientSecret.trim() || !itemIds.trim()}>
                    {busy ? 'Validando e sincronizando…' : 'Conectar e sincronizar'}
                  </Button>
                  {editing && (
                    <Button type="button" variant="secondary" onClick={() => setEditing(false)} disabled={busy}>
                      <Unplug aria-hidden className="size-4" /> Cancelar
                    </Button>
                  )}
                </div>
              </form>
            </div>
          )}
        </>
      )}
    </Card>
  )
}

