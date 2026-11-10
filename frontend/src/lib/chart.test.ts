import { barHeights } from './chart'

describe('barHeights', () => {
  it('escala de zero até o maior valor', () => {
    expect(barHeights([0, 50, 100])).toEqual([12, 56, 100])
  })
  it('série zerada vira barras baixas, sem dividir por zero', () => {
    expect(barHeights([0, 0, 0])).toEqual([12, 12, 12])
  })
  it('com negativos, a base é o menor valor', () => {
    expect(barHeights([-100, 0, 100])).toEqual([12, 56, 100])
  })
  it('série vazia', () => expect(barHeights([])).toEqual([]))
})
