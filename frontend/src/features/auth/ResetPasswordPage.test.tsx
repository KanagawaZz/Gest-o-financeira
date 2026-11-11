import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { ResetPasswordPage } from './ResetPasswordPage'

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

describe('ResetPasswordPage', () => {
  it('mostra erro de link inválido quando não há uid ou token na URL', () => {
    render(
      <MemoryRouter initialEntries={['/redefinir-senha']}>
        <ResetPasswordPage />
      </MemoryRouter>,
    )

    expect(screen.getByText(/Link inválido ou expirado/i)).toBeInTheDocument()
  })

  it('avisa quando as senhas não coincidem', async () => {
    render(
      <MemoryRouter initialEntries={['/redefinir-senha?uid=abc&token=xyz']}>
        <ResetPasswordPage />
      </MemoryRouter>,
    )

    await userEvent.type(screen.getByLabelText(/Nova senha \(mínimo 10/i), 'senha-segura-123')
    await userEvent.type(screen.getByLabelText(/Confirmar nova senha/i), 'outra-coisa')
    await userEvent.click(screen.getByRole('button', { name: /Salvar nova senha/i }))

    await waitFor(() => {
      expect(screen.getByText('As senhas não coincidem.')).toBeInTheDocument()
    })
  })

  it('exibe sucesso quando a senha é redefinida', async () => {
    mockFetch(() => ({ status: 200, body: { message: 'Senha redefinida' } }))

    render(
      <MemoryRouter initialEntries={['/redefinir-senha?uid=abc&token=xyz']}>
        <ResetPasswordPage />
      </MemoryRouter>,
    )

    await userEvent.type(screen.getByLabelText(/Nova senha \(mínimo 10/i), 'senha-segura-123')
    await userEvent.type(screen.getByLabelText(/Confirmar nova senha/i), 'senha-segura-123')
    await userEvent.click(screen.getByRole('button', { name: /Salvar nova senha/i }))

    await waitFor(() => {
      expect(screen.getByText(/Senha alterada com sucesso!/i)).toBeInTheDocument()
    })
  })
})

