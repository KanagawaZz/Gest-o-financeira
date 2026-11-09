import { monthRange, parseMoneyInput, todayISO, toMoneyInput } from './money'

describe('parseMoneyInput', () => {
  it.each([
    ['1.234,56', '1234.56'],
    ['487,5', '487.50'],
    ['50', '50.00'],
    ['0,99', '0.99'],
    ['R$ 3.200,00', '3200.00'],
    ['12.5', '12.50'],
    ['007,10', '7.10'],
  ])('converte %s', (input, expected) => expect(parseMoneyInput(input)).toBe(expected))

  it.each(['', '  ', 'abc', '1,234', '1,2,3', '-5', '10,001'])('rejeita "%s"', (input) =>
    expect(parseMoneyInput(input)).toBeNull(),
  )
})

describe('datas', () => {
  it('todayISO usa a data local', () => expect(todayISO(new Date(2026, 10, 9, 23, 59))).toBe('2026-11-09'))
  it('monthRange cobre o mês inteiro, inclusive fevereiro bissexto', () => {
    expect(monthRange(2026, 11)).toEqual({ from: '2026-11-01', to: '2026-11-30' })
    expect(monthRange(2028, 2)).toEqual({ from: '2028-02-01', to: '2028-02-29' })
  })
  it('toMoneyInput', () => expect(toMoneyInput('487.52')).toBe('487,52'))
})
