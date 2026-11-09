import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ApiError } from '@/services/api'
import type { Category, FinancialAccount, TransactionInput } from '@/types/finance'
import { TransactionForm } from './TransactionForm'

const acc = (id: number, name: string, archived = false): FinancialAccount => ({
  id, name, type: 'checking', initial_balance: '0.00', current_balance: '0.00', color: '#6D91B5', is_archived: archived,
})
const cat = (id: number, name: string, kind: 'expense' | 'income'): Category => ({
  id, name, kind, color: '#6D91B5', icon: 'tag', is_archived: false,
})

const accounts = [acc(1, 'Nubank'), acc(2, 'Reserva'), acc(3, 'Antiga', true)]
const categories = [cat(10, 'Alimentação', 'expense'), cat(11, 'Salário', 'income')]

function setup(onSubmit: (i: TransactionInput) => Promise<void> = async () => {}) {
  render(<TransactionForm accounts={accounts} categories={categories} onSubmit={onSubmit} onCancel={() => {}} />)
  return { user: userEvent.setup(), onSubmit }
}

describe('TransactionForm', () => {
  it('envia despesa com valor convertido para o formato da API', async () => {
    const onSubmit = vi.fn(async () => {})
    const { user } = setup(onSubmit)

    await user.type(screen.getByLabelText('Descrição'), 'Supermercado')
    await user.type(screen.getByLabelText('Valor (R$)'), '1.487,5')
    await user.selectOptions(screen.getByLabelText('Categoria'), 'Alimentação')
    await user.click(screen.getByRole('button', { name: 'Salvar' }))

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1))
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'expense', description: 'Supermercado', amount: '1487.50', category: 10,
        account: 1, destination_account: null, status: 'realized',
      }),
    )
  })

  it('valida campos obrigatórios sem chamar a API', async () => {
    const { user, onSubmit } = setup(vi.fn(async () => {}))
    await user.type(screen.getByLabelText('Valor (R$)'), 'abc')
    await user.click(screen.getByRole('button', { name: 'Salvar' }))

    expect(await screen.findByText('Informe a descrição.')).toBeInTheDocument()
    expect(screen.getByText(/Informe um valor maior que zero/)).toBeInTheDocument()
    expect(screen.getByText('Escolha a categoria.')).toBeInTheDocument()
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('transferência pede destino, esconde categoria e não oferece contas arquivadas', async () => {
    const onSubmit = vi.fn(async () => {})
    const { user } = setup(onSubmit)
    await user.click(screen.getByRole('radio', { name: 'Transferência' }))

    expect(screen.queryByLabelText('Categoria')).not.toBeInTheDocument()
    expect(screen.queryByRole('option', { name: 'Antiga' })).not.toBeInTheDocument()

    await user.type(screen.getByLabelText('Descrição'), 'Guardar')
    await user.type(screen.getByLabelText('Valor (R$)'), '500')
    await user.click(screen.getByRole('button', { name: 'Salvar' }))
    expect(await screen.findByText('Escolha a conta de destino.')).toBeInTheDocument()

    await user.selectOptions(screen.getByLabelText('Conta de destino'), 'Reserva')
    await user.click(screen.getByRole('button', { name: 'Salvar' }))
    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'transfer', category: null, account: 1, destination_account: 2, amount: '500.00' }),
      ),
    )
  })

  it('mostra erros do servidor por campo e preserva o que foi digitado', async () => {
    const onSubmit = vi.fn(async () => {
      throw new ApiError(400, 'validation_error', 'Dados inválidos.', { amount: ['Valor inválido no servidor.'] })
    })
    const { user } = setup(onSubmit)
    await user.type(screen.getByLabelText('Descrição'), 'Mercado')
    await user.type(screen.getByLabelText('Valor (R$)'), '10')
    await user.selectOptions(screen.getByLabelText('Categoria'), 'Alimentação')
    await user.click(screen.getByRole('button', { name: 'Salvar' }))

    expect(await screen.findByText('Valor inválido no servidor.')).toBeInTheDocument()
    expect(screen.getByLabelText('Descrição')).toHaveValue('Mercado')
    expect(screen.getByRole('button', { name: 'Salvar' })).toBeEnabled()
  })

  it('não envia duas vezes ao clicar repetidamente', async () => {
    let release: () => void = () => {}
    const onSubmit = vi.fn(() => new Promise<void>((res) => { release = res }))
    const { user } = setup(onSubmit)
    await user.type(screen.getByLabelText('Descrição'), 'Mercado')
    await user.type(screen.getByLabelText('Valor (R$)'), '10')
    await user.selectOptions(screen.getByLabelText('Categoria'), 'Alimentação')

    await user.click(screen.getByRole('button', { name: 'Salvar' }))
    expect(await screen.findByRole('button', { name: 'Salvando…' })).toBeDisabled()
    await user.click(screen.getByRole('button', { name: 'Salvando…' }))
    expect(onSubmit).toHaveBeenCalledTimes(1)
    release()
  })
})
