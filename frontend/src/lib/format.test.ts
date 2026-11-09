import { formatBRL, formatDate } from './format'

describe('formatBRL', () => {
  it('usa o padrão pt-BR', () => {
    expect(formatBRL('3200.00').replace(/\s/g, ' ')).toBe('R$ 3.200,00')
    expect(formatBRL('-487.52').replace(/\s/g, ' ')).toBe('-R$ 487,52')
  })
})

describe('formatDate', () => {
  it('converte ISO para dd/mm/aaaa sem deslocar o dia por fuso', () => {
    expect(formatDate('2026-11-01')).toBe('01/11/2026')
    expect(formatDate('2026-11-01T00:00:00-04:00')).toBe('01/11/2026')
  })
})
