import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { AuthProvider } from './AuthProvider'
import { LoginPage } from './LoginPage'

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

describe('LoginPage', () => {
  it('mostra a mensagem do servidor quando as credenciais são inválidas', async () => {
    document.cookie = 'csrftoken=abc'
    mockFetch((url) => {
      if (url.endsWith('/auth/me/')) return { status: 403, body: { error: { code: 'not_authenticated', message: 'x', details: null } } }
      return { status: 400, body: { error: { code: 'invalid_credentials', message: 'Usuário ou senha incorretos.', details: null } } }
    })

    render(
      <MemoryRouter>
        <AuthProvider>
          <LoginPage />
        </AuthProvider>
      </MemoryRouter>,
    )

    await userEvent.type(await screen.findByLabelText('Usuário'), 'ana')
    await userEvent.type(screen.getByLabelText('Senha'), 'errada')
    await userEvent.click(screen.getByRole('button', { name: 'Entrar' }))

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Usuário ou senha incorretos.'))
  })

  it('mantém o botão desabilitado enquanto os campos estão vazios', async () => {
    mockFetch(() => ({ status: 403, body: { error: { code: 'x', message: 'x', details: null } } }))
    render(
      <MemoryRouter>
        <AuthProvider>
          <LoginPage />
        </AuthProvider>
      </MemoryRouter>,
    )
    expect(await screen.findByRole('button', { name: 'Entrar' })).toBeDisabled()
  })
})
