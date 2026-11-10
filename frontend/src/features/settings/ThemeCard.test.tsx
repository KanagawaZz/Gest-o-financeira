import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ThemeProvider } from '@/app/providers/ThemeProvider'
import { ThemeCard } from './ThemeCard'

const root = document.documentElement

beforeEach(() => {
  localStorage.clear()
  delete root.dataset.tema
  delete root.dataset.fase
  delete root.dataset.estilo
})

describe('Aparência (tema pelo horário)', () => {
  it('no modo automático aplica a fase do sol e mostra a próxima troca', () => {
    render(<ThemeProvider><ThemeCard /></ThemeProvider>)
    expect(['claro', 'escuro']).toContain(root.dataset.tema)
    expect(['manha', 'tarde', 'entardecer', 'noite']).toContain(root.dataset.fase)
    expect(screen.getByRole('radio', { name: /Pelo horário/ })).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByText(/sol nasce .* e se põe/)).toBeInTheDocument()
  })

  it('fixar um período troca o tema, salva no aparelho e volta ao automático', async () => {
    const user = userEvent.setup()
    render(<ThemeProvider><ThemeCard /></ThemeProvider>)

    await user.click(screen.getByRole('radio', { name: /Noite/ }))
    expect(root.dataset.tema).toBe('escuro')
    expect(root.dataset.fase).toBe('noite')
    expect(localStorage.getItem('nexo.tema')).toBe('noite')

    for (const [name, fase] of [[/Manhã/, 'manha'], [/Tarde/, 'tarde'], [/Entardecer/, 'entardecer']] as const) {
      await user.click(screen.getByRole('radio', { name }))
      expect([root.dataset.fase, root.dataset.tema, localStorage.getItem('nexo.tema')]).toEqual([fase, 'claro', fase])
    }

    await user.click(screen.getByRole('radio', { name: /Pelo horário/ }))
    expect(localStorage.getItem('nexo.tema')).toBeNull()
    expect(screen.getByText(/sol nasce/)).toBeInTheDocument()
  })

  it('respeita a escolha salva ao abrir o app, inclusive a do formato antigo (claro/escuro)', () => {
    localStorage.setItem('nexo.tema', 'tarde')
    const { unmount } = render(<ThemeProvider><ThemeCard /></ThemeProvider>)
    expect(root.dataset.fase).toBe('tarde')
    expect(screen.getByRole('radio', { name: /Tarde/ })).toHaveAttribute('aria-checked', 'true')
    unmount()
    localStorage.setItem('nexo.tema', 'escuro')
    render(<ThemeProvider><ThemeCard /></ThemeProvider>)
    expect(root.dataset.fase).toBe('noite')
  })

  it('trocar para o tema Azul muda o visual, salva no aparelho e esconde os períodos; voltar devolve o período', async () => {
    const user = userEvent.setup()
    localStorage.setItem('nexo.tema', 'tarde')
    render(<ThemeProvider><ThemeCard /></ThemeProvider>)
    expect(screen.getByRole('radio', { name: /Cidade/ })).toHaveAttribute('aria-checked', 'true')
    expect(root.dataset.estilo).toBe('cidade')

    await user.click(screen.getByRole('radio', { name: /Azul/ }))
    expect([root.dataset.estilo, root.dataset.fase, root.dataset.tema]).toEqual(['azul', 'azul', 'azul'])
    expect(localStorage.getItem('nexo.estilo')).toBe('azul')
    expect(screen.getByRole('radio', { name: /Azul/ })).toHaveAttribute('aria-checked', 'true')
    expect(screen.queryByRole('radiogroup', { name: 'Período do tema' })).not.toBeInTheDocument()

    await user.click(screen.getByRole('radio', { name: /Cidade/ }))
    expect([root.dataset.estilo, root.dataset.fase, root.dataset.tema]).toEqual(['cidade', 'tarde', 'claro'])
    expect(localStorage.getItem('nexo.estilo')).toBeNull()
    expect(screen.getByRole('radio', { name: /Tarde/ })).toHaveAttribute('aria-checked', 'true')
  })

  it('abre já no tema Azul quando ele está salvo', () => {
    localStorage.setItem('nexo.estilo', 'azul')
    render(<ThemeProvider><ThemeCard /></ThemeProvider>)
    expect(root.dataset.fase).toBe('azul')
    expect(screen.getByRole('radio', { name: /Azul/ })).toHaveAttribute('aria-checked', 'true')
  })
})
