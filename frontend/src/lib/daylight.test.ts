import { phaseAt, schemeOf, sunTimes } from './daylight'

// Horários em Cuiabá (UTC-4, sem horário de verão) para conferir com o calendário solar.
const cuiaba = (iso: string) => new Date(`${iso}-04:00`)
const hhmm = (d: Date) => d.toLocaleTimeString('pt-BR', { timeZone: 'America/Cuiaba', hour: '2-digit', minute: '2-digit' })

describe('sunTimes (Cuiabá)', () => {
  it('bate com a fórmula completa da NOAA (± 2 min)', () => {
    // Referências calculadas com a planilha NOAA (General Solar Position) para -15,601 / -56,097, UTC-4.
    const near = (d: Date, ref: string) => {
      const [h, m] = ref.split(':').map(Number) as [number, number]
      const [dh, dm] = hhmm(d).split(':').map(Number) as [number, number]
      return Math.abs(dh * 60 + dm - (h * 60 + m)) <= 2
    }
    const cases: [string, string, string][] = [
      ['2026-03-20', '05:48', '17:55'],
      ['2026-06-21', '06:10', '17:22'],
      ['2026-09-22', '05:34', '17:40'],
      ['2026-12-21', '05:11', '18:14'],
    ]
    for (const [day, rise, set] of cases) {
      const s = sunTimes(cuiaba(`${day}T12:00:00`))
      expect([day, near(s.sunrise, rise), near(s.sunset, set)]).toEqual([day, true, true])
    }
  })
})

describe('phaseAt', () => {
  // 10/11/2026 em Cuiabá: sol nasce 05:04, meio-dia solar ~11:28, pôr do sol 17:51.
  it('percorre o dia na ordem: noite → manhã → tarde → entardecer → noite', () => {
    const seq = ['03:00', '04:40', '09:00', '13:00', '17:00', '18:10', '18:30', '21:00'].map((t) => phaseAt(cuiaba(`2026-11-10T${t}:00`)).phase)
    expect(seq).toEqual(['noite', 'manha', 'manha', 'tarde', 'entardecer', 'entardecer', 'noite', 'noite'])
  })

  it('vidro claro de manhã, à tarde e no entardecer; azul-marinho à noite', () => {
    expect(phaseAt(cuiaba('2026-11-10T13:00:00')).scheme).toBe('claro')
    expect(phaseAt(cuiaba('2026-11-10T17:30:00')).scheme).toBe('claro')
    expect(phaseAt(cuiaba('2026-11-10T22:00:00')).scheme).toBe('escuro')
    expect(schemeOf('entardecer')).toBe('claro')
    expect(schemeOf('noite')).toBe('escuro')
  })

  it('informa a próxima troca, inclusive atravessando a meia-noite', () => {
    const day = phaseAt(cuiaba('2026-11-10T13:00:00'))
    expect(day.nextPhase).toBe('entardecer')
    expect(day.nextChange.getTime()).toBeGreaterThan(cuiaba('2026-11-10T13:00:00').getTime())
    const late = phaseAt(cuiaba('2026-11-10T23:30:00'))
    expect(late.nextPhase).toBe('manha')
    expect(hhmm(late.nextChange) < '06:00' && late.nextChange.getUTCDate() === 11).toBe(true)
    const early = phaseAt(cuiaba('2026-11-10T02:00:00'))
    expect(early.nextPhase).toBe('manha')
    expect(early.nextChange.getUTCDate()).toBe(10)
  })
})
