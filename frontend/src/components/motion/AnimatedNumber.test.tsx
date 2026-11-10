import { act, render } from '@testing-library/react'
import { AnimatedMoney, AnimatedPercent } from './AnimatedNumber'

// Relógio e quadros controlados: cada `frame(ms)` avança o tempo e roda os callbacks agendados.
let now = 0
let queue: FrameRequestCallback[] = []
function setReduced(reduced: boolean) {
  vi.stubGlobal('matchMedia', () => ({ matches: reduced, addEventListener() {}, removeEventListener() {} }))
}
function frame(ms: number) {
  now += ms
  act(() => {
    const cbs = queue
    queue = []
    cbs.forEach((cb) => cb(now))
  })
}
const text = (c: HTMLElement) => (c.textContent ?? '').replace(/\s/g, ' ')
const toNumber = (s: string) => Number(s.replace(/[^\d,-]/g, '').replace(',', '.'))

beforeEach(() => {
  now = 0
  queue = []
  setReduced(false)
  vi.spyOn(performance, 'now').mockImplementation(() => now)
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => queue.push(cb))
  vi.stubGlobal('cancelAnimationFrame', () => {})
})
afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('AnimatedMoney', () => {
  it('sobe de R$ 0,00 até o valor exato, sem ultrapassar nem oscilar, sempre em formato brasileiro', () => {
    const { container } = render(<AnimatedMoney value="1250.00" />)
    expect(text(container)).toBe('R$ 0,00')
    const seen: number[] = []
    for (let i = 0; i < 80; i++) {
      frame(16)
      expect(text(container)).toMatch(/^R\$ \d{1,3}(\.\d{3})*,\d{2}$/)
      seen.push(toNumber(text(container)))
    }
    expect(text(container)).toBe('R$ 1.250,00')
    expect(seen.every((v, i) => i === 0 || v >= seen[i - 1]!)).toBe(true) // nunca volta
    expect(Math.max(...seen)).toBe(1250) // nunca passa do valor real
  })

  it('quando o valor muda, anima a partir do valor atual (inclusive para baixo)', () => {
    const { container, rerender } = render(<AnimatedMoney value="1250.00" />)
    for (let i = 0; i < 80; i++) frame(16)
    rerender(<AnimatedMoney value="1000.00" />)
    const seen: number[] = []
    for (let i = 0; i < 60; i++) {
      frame(16)
      seen.push(toNumber(text(container)))
    }
    expect(text(container)).toBe('R$ 1.000,00')
    expect(seen[0]).toBe(1250) // 1º quadro: parte exatamente do valor atual (sem salto)
    expect(seen[5]).toBeLessThan(1250)
    expect(seen.every((v, i) => i === 0 || v <= seen[i - 1]!)).toBe(true)
  })

  it('nunca mostra valor fora do intervalo quando o carimbo do quadro é anterior ao agendamento', () => {
    now = 1000 // performance.now() no momento em que a animação é agendada
    const { container } = render(<AnimatedMoney value="3200.00" />)
    // o navegador entrega quadros com carimbo um pouco ANTERIOR (início do quadro)
    for (const t of [990, 995, 1010, 1100, 1600, 2300]) {
      act(() => {
        const cbs = queue
        queue = []
        cbs.forEach((cb) => cb(t))
      })
      const v = toNumber(text(container))
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThanOrEqual(3200)
    }
    expect(text(container)).toBe('R$ 3.200,00')
  })

  it('aceita negativos e centavos quebrados', () => {
    const { container } = render(<AnimatedMoney value="-487.52" />)
    for (let i = 0; i < 80; i++) frame(16)
    expect(text(container)).toBe('-R$ 487,52')
  })

  it('com "reduzir movimento" mostra o valor final direto, sem agendar quadros', () => {
    setReduced(true)
    const { container } = render(<AnimatedMoney value="3200.00" />)
    expect(text(container)).toBe('R$ 3.200,00')
    expect(queue).toHaveLength(0)
  })

  it('valor ausente vira travessão', () => {
    const { container } = render(<AnimatedMoney value={null} />)
    expect(text(container)).toBe('—')
  })
})

describe('AnimatedPercent', () => {
  it('pousa no percentual exato com uma casa', () => {
    const { container } = render(<AnimatedPercent value={141.8} />)
    for (let i = 0; i < 80; i++) frame(16)
    expect(text(container)).toBe('141,8%')
  })
})
