/**
 * Períodos do dia pelo sol de verdade (nascer/pôr calculados para Cuiabá, fuso do app):
 *   manhã (do amanhecer ao meio-dia solar) · tarde · entardecer (1 h antes a 30 min depois do pôr do sol) · noite.
 * Manhã, tarde e entardecer usam vidro claro; a noite usa vidro azul-marinho.
 * Algoritmo: equação do nascer do sol (NOAA simplificada), erro de ~1–2 min — sobra para trocar um tema.
 */

export type Phase = 'manha' | 'tarde' | 'entardecer' | 'noite'
export type Scheme = 'claro' | 'escuro'

const CUIABA = { lat: -15.601, lon: -56.097 }

export const PHASES: Phase[] = ['manha', 'tarde', 'entardecer', 'noite']

export const PHASE_LABEL: Record<Phase, string> = {
  manha: 'Manhã',
  tarde: 'Tarde',
  entardecer: 'Entardecer',
  noite: 'Noite',
}

export const schemeOf = (p: Phase): Scheme => (p === 'noite' ? 'escuro' : 'claro')

const RAD = Math.PI / 180
const DAY_MS = 86_400_000
const MIN_MS = 60_000
const J2000 = 2451545
const jdToDate = (jd: number) => new Date((jd - 2440587.5) * DAY_MS)

/** Nascer e pôr do sol para o dia (data do calendário local de `date`). */
export function sunTimes(date: Date, { lat, lon } = CUIABA): { sunrise: Date; sunset: Date } {
  const jdNoon = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate(), 12) / DAY_MS + 2440587.5
  const n = Math.round(jdNoon - J2000 + 0.0008)
  const jStar = n - lon / 360
  const M = (357.5291 + 0.98560028 * jStar) % 360
  const C = 1.9148 * Math.sin(M * RAD) + 0.02 * Math.sin(2 * M * RAD) + 0.0003 * Math.sin(3 * M * RAD)
  const lambda = (M + C + 180 + 102.9372) % 360
  const transit = J2000 + jStar + 0.0053 * Math.sin(M * RAD) - 0.0069 * Math.sin(2 * lambda * RAD)
  const sinDec = Math.sin(lambda * RAD) * Math.sin(23.4397 * RAD)
  const cosDec = Math.cos(Math.asin(sinDec))
  const cosW = (Math.sin(-0.833 * RAD) - Math.sin(lat * RAD) * sinDec) / (Math.cos(lat * RAD) * cosDec)
  const w = Math.acos(Math.min(1, Math.max(-1, cosW))) / RAD
  return { sunrise: jdToDate(transit - w / 360), sunset: jdToDate(transit + w / 360) }
}

/** Início de cada período em relação ao sol (minutos). A tarde começa no meio-dia solar. */
const OFFSETS = { morning: -30, dusk: -60, night: 30 } as const

function boundaries(day: Date) {
  const { sunrise, sunset } = sunTimes(day)
  const at = (base: Date, min: number) => new Date(base.getTime() + min * MIN_MS)
  return {
    sunrise,
    sunset,
    manha: at(sunrise, OFFSETS.morning),
    tarde: new Date((sunrise.getTime() + sunset.getTime()) / 2),
    entardecer: at(sunset, OFFSETS.dusk),
    noite: at(sunset, OFFSETS.night),
  }
}

export type DayState = { phase: Phase; scheme: Scheme; nextChange: Date; nextPhase: Phase; sunrise: Date; sunset: Date }

/** Em que fase estamos agora e quando ela muda. */
export function phaseAt(now: Date): DayState {
  const b = boundaries(now)
  const order = PHASES
  let phase: Phase = 'noite' // madrugada, antes do amanhecer
  for (const p of order) if (now >= b[p]) phase = p
  const i = order.indexOf(phase)
  let nextPhase: Phase
  let nextChange: Date
  if (phase === 'noite' && now >= b.noite) {
    nextPhase = 'manha'
    nextChange = boundaries(new Date(now.getTime() + DAY_MS)).manha
  } else if (phase === 'noite') {
    nextPhase = 'manha'
    nextChange = b.manha
  } else {
    nextPhase = order[i + 1] as Phase
    nextChange = b[nextPhase]
  }
  return { phase, scheme: schemeOf(phase), nextChange, nextPhase, sunrise: b.sunrise, sunset: b.sunset }
}
