import { periodLabel, periodRange, shiftPeriod } from './period'

describe('periodRange', () => {
  it('mês, trimestre, semestre e ano contêm a âncora', () => {
    expect(periodRange('month', { year: 2026, month: 11 })).toEqual({ from: '2026-11-01', to: '2026-11-30' })
    expect(periodRange('quarter', { year: 2026, month: 11 })).toEqual({ from: '2026-10-01', to: '2026-12-31' })
    expect(periodRange('quarter', { year: 2026, month: 1 })).toEqual({ from: '2026-01-01', to: '2026-03-31' })
    expect(periodRange('semester', { year: 2026, month: 6 })).toEqual({ from: '2026-01-01', to: '2026-06-30' })
    expect(periodRange('semester', { year: 2026, month: 7 })).toEqual({ from: '2026-07-01', to: '2026-12-31' })
    expect(periodRange('year', { year: 2026, month: 3 })).toEqual({ from: '2026-01-01', to: '2026-12-31' })
  })
  it('fevereiro bissexto', () => expect(periodRange('month', { year: 2028, month: 2 }).to).toBe('2028-02-29'))
})

describe('shiftPeriod', () => {
  it('atravessa a virada de ano', () => {
    expect(shiftPeriod('month', { year: 2026, month: 12 }, 1)).toEqual({ year: 2027, month: 1 })
    expect(shiftPeriod('month', { year: 2026, month: 1 }, -1)).toEqual({ year: 2025, month: 12 })
    expect(shiftPeriod('quarter', { year: 2026, month: 11 }, 1)).toEqual({ year: 2027, month: 2 })
    expect(shiftPeriod('year', { year: 2026, month: 5 }, -1)).toEqual({ year: 2025, month: 5 })
  })
})

describe('periodLabel', () => {
  it('rotula cada tipo', () => {
    expect(periodLabel('quarter', { year: 2026, month: 11 })).toBe('4º trimestre de 2026')
    expect(periodLabel('semester', { year: 2026, month: 3 })).toBe('1º semestre de 2026')
    expect(periodLabel('year', { year: 2026, month: 3 })).toBe('2026')
  })
})
