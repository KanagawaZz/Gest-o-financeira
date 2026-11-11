import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { AuthProvider } from './AuthProvider'
import { RegisterPage } from './RegisterPage'

function mockFetch(handler: (url: string, init?: RequestInit) => { status: number; body?: unknown }) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init?: RequestInit) => {
      const { status, body } = handler(url, init)
      return new Response(body === undefined ? null : JSON.stringify(body), { status })
    }),
  )
}

afterEach(() => vi.unstubAllGlobals())

describe('RegisterPage', () => {
  it('mantém o botão desabilitado enquanto campos obrigatórios estão vazios', async () => {
    mockFetch((url) => {
      if (url.endsWith('/auth/me/')) return { status: 403, body: { error: { code: 'x', message: 'x', details: null } } }
      return { status: 200, body: { enabled: true } }
    })

    render(
      <MemoryRouter>
        <AuthProvider>
          <RegisterPage />
        </AuthProvider>
      </MemoryRouter>,
    )

    expect(await screen.findByRole('button', { name: 'Criar minha conta' })).toBeDisabled()
  })

  it('avisa quando as senhas não coincidem', async () => {
    mockFetch((url) => {
      if (url.endsWith('/auth/me/')) return { status: 403, body: { error: { code: 'x', message: 'x', details: null } } }
      return { status: 200, body: { enabled: true } }
    })

    render(
      <MemoryRouter>
        <AuthProvider>
          <RegisterPage />
        </AuthProvider>
      </MemoryRouter>,
    )

    await userEvent.type(await screen.findByLabelText(/Nome de usuário/i), 'novousuario')
    await userEvent.type(screen.getByLabelText(/Senha \(mínimo 10/i), 'senha-segura-123')
    await userEvent.type(screen.getByLabelText(/Confirmar senha/i), 'outra-senha-diferente')

    await userEvent.click(screen.getByRole('button', { name: 'Criar minha conta' }))

    await waitFor(() => {
      expect(screen.getByText('As senhas não coincidem.')).toBeInTheDocument()
    })
  })

  it('mostra mensagem quando cadastros estão suspensos', async () => {
    mockFetch((url) => {
      if (url.endsWith('/auth/me/')) return { status: 403, body: { error: { code: 'x', message: 'x', details: null } } }
      return { status: 200, body: { enabled: false } }
    })

    render(
      <MemoryRouter>
        <AuthProvider>
          <RegisterPage />
        </AuthProvider>
      </MemoryRouter>,
    )

    await waitFor(() => {
      expect(screen.getByText('Novos cadastros suspensos')).toBeInTheDocument()
    })
  })
})

