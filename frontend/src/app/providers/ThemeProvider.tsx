import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { flushSync } from 'react-dom'
import { PHASES, phaseAt, schemeOf, type DayState, type Phase, type Scheme } from '@/lib/daylight'

/** auto = acompanha o sol; um período fixo vale só neste aparelho. */
export type ThemeMode = 'auto' | Phase

/**
 * Tema do sistema (vale só neste aparelho):
 *  - cidade: foto da cidade e vidro fumê; a luz muda com o período do dia;
 *  - azul: claro e plano (fundo branco, cards cinza, azul como cor de ação); não muda com o horário.
 */
export type ThemeStyle = 'cidade' | 'azul'

type ThemeState = {
  style: ThemeStyle
  setStyle: (s: ThemeStyle) => void
  mode: ThemeMode
  setMode: (m: ThemeMode) => void
  phase: Phase
  scheme: Scheme
  /** Só no modo automático: próxima troca de período e horários do sol de hoje. */
  day: DayState | null
}

const STORAGE_KEY = 'nexo.tema'
const STYLE_KEY = 'nexo.estilo'
const THEME_COLOR: Record<Phase, string> = { manha: '#2f4a66', tarde: '#3a4a5c', entardecer: '#3b3446', noite: '#0f1a2e' }
const BLUE_THEME_COLOR = '#0a53d1'
const LEGACY: Record<string, Phase> = { claro: 'manha', escuro: 'noite' } // escolhas salvas antes dos 4 períodos

// Fora do provider (testes de componente isolado): cidade à noite, o visual histórico.
const ThemeContext = createContext<ThemeState>({
  style: 'cidade',
  setStyle: () => {},
  mode: 'noite',
  setMode: () => {},
  phase: 'noite',
  scheme: 'escuro',
  day: null,
})

function readMode(): ThemeMode {
  try {
    const v = localStorage.getItem(STORAGE_KEY) ?? ''
    if ((PHASES as string[]).includes(v)) return v as Phase
    return LEGACY[v] ?? 'auto'
  } catch {
    return 'auto' // armazenamento bloqueado (aba privada etc.): segue o sol
  }
}

function readStyle(): ThemeStyle {
  try {
    return localStorage.getItem(STYLE_KEY) === 'azul' ? 'azul' : 'cidade'
  } catch {
    return 'cidade'
  }
}

function resolve(mode: ThemeMode, now: Date): { phase: Phase; day: DayState | null } {
  if (mode !== 'auto') return { phase: mode, day: null }
  const day = phaseAt(now)
  return { phase: day.phase, day }
}

/** O CSS lê `data-fase`/`data-tema`: um período do dia + claro/escuro (tema cidade), ou `azul` nos dois (tema azul). */
function apply(phase: Phase, style: ThemeStyle) {
  const root = document.documentElement
  const blue = style === 'azul'
  root.dataset.estilo = style
  root.dataset.fase = blue ? 'azul' : phase
  root.dataset.tema = blue ? 'azul' : schemeOf(phase)
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', blue ? BLUE_THEME_COLOR : THEME_COLOR[phase])
}

/** Troca com um cross-fade lento (View Transitions) quando há suporte e o usuário não pediu menos movimento. */
function withTransition(update: () => void) {
  const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  const doc = document as Document & { startViewTransition?: (cb: () => void) => unknown }
  if (doc.startViewTransition && !reduce) doc.startViewTransition(() => flushSync(update))
  else update()
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [style, setStyleState] = useState<ThemeStyle>(readStyle)
  const [mode, setModeState] = useState<ThemeMode>(readMode)
  const [state, setState] = useState(() => resolve(readMode(), new Date()))
  // O que está na tela agora, para decidir se uma troca merece o cross-fade.
  const shown = useRef({ phase: state.phase, style })

  useLayoutEffect(() => {
    shown.current = { phase: state.phase, style }
    apply(state.phase, style)
  }, [state.phase, style])

  const refresh = useCallback((m: ThemeMode, animate: boolean) => {
    const next = resolve(m, new Date())
    // Mesmo período, ou tema azul (que não muda com o horário): nada muda na tela.
    if (next.phase === shown.current.phase || shown.current.style === 'azul') {
      setState(next)
      return
    }
    const update = () => setState(next)
    if (animate) withTransition(update)
    else update()
  }, [])

  // Reavalia a cada minuto e quando a aba volta a ficar visível (o celular pode ter dormido por horas).
  useEffect(() => {
    if (mode !== 'auto') return
    const tick = () => refresh('auto', true)
    const id = window.setInterval(tick, 60_000)
    const onVisible = () => document.visibilityState === 'visible' && tick()
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      window.clearInterval(id)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [mode, refresh])

  const setMode = useCallback(
    (m: ThemeMode) => {
      try {
        if (m === 'auto') localStorage.removeItem(STORAGE_KEY)
        else localStorage.setItem(STORAGE_KEY, m)
      } catch {
        /* sem armazenamento: vale só nesta sessão */
      }
      setModeState(m)
      refresh(m, true)
    },
    [refresh],
  )

  const setStyle = useCallback((s: ThemeStyle) => {
    try {
      if (s === 'cidade') localStorage.removeItem(STYLE_KEY)
      else localStorage.setItem(STYLE_KEY, s)
    } catch {
      /* sem armazenamento: vale só nesta sessão */
    }
    if (s === shown.current.style) return
    withTransition(() => setStyleState(s))
  }, [])

  const value = useMemo<ThemeState>(
    () => ({ style, setStyle, mode, setMode, phase: state.phase, scheme: style === 'azul' ? 'claro' : schemeOf(state.phase), day: state.day }),
    [style, setStyle, mode, setMode, state],
  )
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useTheme(): ThemeState {
  return useContext(ThemeContext)
}
