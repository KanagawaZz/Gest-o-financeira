import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { ForgotPasswordPage } from './ForgotPasswordPage'

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

describe('ForgotPasswordPage', () => {
  it('desabilita o botão quando o e-mail não foi preenchido', () => {
    render(
      <MemoryRouter>
        <ForgotPasswordPage />
      </MemoryRouter>,
    )

    expect(screen.getByRole('button', { name: /Enviar link de recuperação/i })).toBeDisabled()
  })

  it('exibe mensagem de confirmação ao enviar e-mail válido', async () => {
    mockFetch(() => ({ status: 200, body: { message: 'ok' } }))

    render(
      <MemoryRouter>
        <ForgotPasswordPage />
      </MemoryRouter>,
    )

    await userEvent.type(screen.getByLabelText(/E-mail cadastrado/i), 'teste@exemplo.com')
    await userEvent.click(screen.getByRole('button', { name: /Enviar link de recuperação/i }))

    await waitFor(() => {
      expect(screen.getByText(/Instruções enviadas!/i)).toBeInTheDocument()
      expect(screen.getByText('teste@exemplo.com')).toBeInTheDocument()
    })
  })
})

