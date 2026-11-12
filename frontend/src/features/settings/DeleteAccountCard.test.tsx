import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthProvider, useAuth } from '../auth/AuthProvider'
import { DeleteAccountCard } from './DeleteAccountCard'

let deleteStatus = 204
const deleteCalls = () => vi.mocked(fetch).mock.calls.filter(([u]) => String(u).includes('/auth/delete-account/'))

beforeEach(() => {
  deleteStatus = 204
  document.cookie = 'csrftoken=abc'
  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    if (url.includes('/auth/me/')) return new Response(JSON.stringify({ id: 7, username: 'ana', first_name: 'Ana', email: '' }), { status: 200 })
    if (url.includes('/auth/delete-account/')) {
      if (deleteStatus === 204) return new Response(null, { status: 204 })
      return new Response(JSON.stringify({ error: { code: 'validation_error', message: 'Dados inválidos.', details: { password: ['Senha incorreta.'] } } }), { status: 400 })
    }
    return new Response('{}', { status: 404 })
  }))
})
afterEach(() => vi.unstubAllGlobals())

function Who() {
  const { user, loading } = useAuth()
  return <p data-testid="who">{loading ? 'carregando' : (user?.username ?? 'sem usuário')}</p>
}

function mount() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  qc.setQueryData(['accounts'], [{ id: 1 }])
  render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <AuthProvider>
          <Who />
          <DeleteAccountCard />
        </AuthProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  )
  return qc
}

async function openDialog() {
  await waitFor(() => expect(screen.getByTestId('who')).toHaveTextContent('ana'))
  await userEvent.click(screen.getByRole('button', { name: 'Excluir minha conta' }))
}

describe('excluir conta', () => {
  it('explica o que será apagado, oferece a exportação e só libera com a senha', async () => {
    mount()
    await openDialog()
    expect(screen.getByText(/serão apagados para sempre/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Baixar uma cópia antes/ })).toHaveAttribute('href', '/api/v1/auth/export/')
    expect(screen.getByRole('button', { name: 'Excluir definitivamente' })).toBeDisabled()
    expect(deleteCalls()).toHaveLength(0)
  })

  it('cancelar não exclui nada', async () => {
    mount()
    await openDialog()
    await userEvent.type(screen.getByLabelText('Digite sua senha para confirmar'), 'senha-segura-123')
    await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(deleteCalls()).toHaveLength(0)
    expect(screen.getByTestId('who')).toHaveTextContent('ana')
  })

  it('senha errada: mostra o erro no campo e mantém a pessoa logada', async () => {
    deleteStatus = 400
    mount()
    await openDialog()
    await userEvent.type(screen.getByLabelText('Digite sua senha para confirmar'), 'errada')
    await userEvent.click(screen.getByRole('button', { name: 'Excluir definitivamente' }))
    expect(await screen.findByText('Senha incorreta.')).toBeInTheDocument()
    expect(screen.getByTestId('who')).toHaveTextContent('ana')
  })

  it('senha certa: envia a senha, limpa os dados em memória e encerra a sessão', async () => {
    const qc = mount()
    await openDialog()
    await userEvent.type(screen.getByLabelText('Digite sua senha para confirmar'), 'senha-segura-123')
    await userEvent.click(screen.getByRole('button', { name: 'Excluir definitivamente' }))
    await waitFor(() => expect(screen.getByTestId('who')).toHaveTextContent('sem usuário'))
    const [, init] = deleteCalls()[0]!
    expect(JSON.parse(String((init as RequestInit).body))).toEqual({ password: 'senha-segura-123' })
    expect((init as RequestInit).method).toBe('POST')
    expect(qc.getQueryData(['accounts'])).toBeUndefined()
  })
})
