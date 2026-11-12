import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthProvider } from '../auth/AuthProvider'
import { FirstSteps } from './FirstSteps'
import { isHidden } from './steps'

const none = { account: false, recurring: false, transaction: false, card: false, goal: false }
let steps = none
let onboardingStatus = 200
const onboardingCalls = () => vi.mocked(fetch).mock.calls.filter(([u]) => String(u).includes('/dashboard/onboarding/')).length

beforeEach(() => {
  localStorage.clear()
  steps = none
  onboardingStatus = 200
  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    if (url.includes('/auth/me/')) return new Response(JSON.stringify({ id: 7, username: 'ana', first_name: 'Ana', email: '' }), { status: 200 })
    if (url.includes('/dashboard/onboarding/')) {
      const body = onboardingStatus === 200 ? { steps } : { error: { code: 'x', message: 'x', details: null } }
      return new Response(JSON.stringify(body), { status: onboardingStatus })
    }
    return new Response('{}', { status: 404 })
  }))
})
afterEach(() => vi.unstubAllGlobals())

function Where() {
  const l = useLocation()
  return <p data-testid="where">{l.pathname + l.search}</p>
}

function mount() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <AuthProvider>
          <Routes>
            <Route path="*" element={<><FirstSteps /><Where /></>} />
          </Routes>
        </AuthProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('guia de primeiros passos', () => {
  it('conta nova: explica cada coisa, destaca o primeiro passo e bloqueia o que depende de conta', async () => {
    mount()
    expect(await screen.findByRole('heading', { name: 'Primeiros passos' })).toBeInTheDocument()
    expect(screen.getByText('0 de 3 passos essenciais')).toBeInTheDocument()
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '0')
    expect(screen.getByText(/Conta do banco, carteira ou poupança/)).toBeInTheDocument()
    expect(screen.getByText(/Você cadastra uma vez e o NEXO lança os próximos meses/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Cadastrar conta' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Cadastrar compromisso' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Registrar movimentação' })).toBeDisabled()
    expect(screen.getAllByText('Cadastre uma conta primeiro.')).toHaveLength(2)
    expect(screen.getByRole('button', { name: 'Cadastrar cartão' })).toBeEnabled() // opcional, não depende de conta
  })

  it('o botão do passo leva à tela certa', async () => {
    mount()
    await userEvent.click(await screen.findByRole('button', { name: 'Cadastrar conta' }))
    expect(screen.getByTestId('where')).toHaveTextContent('/contas?aba=contas')
  })

  it('marca como feito o que já existe e libera os próximos', async () => {
    steps = { ...none, account: true }
    mount()
    expect(await screen.findByText('1 de 3 passos essenciais')).toBeInTheDocument()
    expect(screen.getByText('Feito')).toBeInTheDocument() // status em texto, não só cor
    expect(screen.queryByRole('button', { name: 'Cadastrar conta' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Cadastrar compromisso' })).toBeEnabled()
  })

  it('essencial concluído: avisa que está pronto e "Concluir" oculta o guia', async () => {
    steps = { ...none, account: true, recurring: true, transaction: true }
    mount()
    expect(await screen.findByRole('heading', { name: 'Tudo pronto para começar' })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Concluir' }))
    expect(screen.queryByRole('heading', { name: 'Tudo pronto para começar' })).not.toBeInTheDocument()
    expect(isHidden(7)).toBe(true)
  })

  it('"Ocultar" esconde o guia e a próxima visita nem consulta o servidor', async () => {
    const first = mount()
    await userEvent.click(await screen.findByRole('button', { name: 'Ocultar primeiros passos' }))
    expect(screen.queryByRole('heading', { name: 'Primeiros passos' })).not.toBeInTheDocument()
    expect(isHidden(7)).toBe(true)
    first.unmount()

    const before = onboardingCalls()
    mount()
    await screen.findByTestId('where')
    await waitFor(() => expect(vi.mocked(fetch).mock.calls.some(([u]) => String(u).includes('/auth/me/'))).toBe(true))
    expect(onboardingCalls()).toBe(before)
  })

  it('tudo feito: o guia não aparece', async () => {
    steps = { account: true, recurring: true, transaction: true, card: true, goal: true }
    mount()
    await waitFor(() => expect(onboardingCalls()).toBe(1))
    expect(screen.queryByRole('heading', { name: /Primeiros passos|Tudo pronto/ })).not.toBeInTheDocument()
  })

  it('falha na consulta: o guia não aparece e nada quebra', async () => {
    onboardingStatus = 500
    mount()
    await waitFor(() => expect(onboardingCalls()).toBe(1))
    expect(screen.queryByRole('heading', { name: /Primeiros passos|Tudo pronto/ })).not.toBeInTheDocument()
    expect(screen.getByTestId('where')).toBeInTheDocument()
  })
})
