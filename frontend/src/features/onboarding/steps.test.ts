import { beforeEach, describe, expect, it } from 'vitest'
import { STEPS, isBlocked, isHidden, progress, setHidden } from './steps'

const none = { account: false, recurring: false, transaction: false, card: false, goal: false }
const step = (key: string) => STEPS.find((s) => s.key === key)!

describe('primeiros passos: progresso', () => {
  it('conta nova: nada feito e o primeiro passo é cadastrar a conta', () => {
    expect(progress(none)).toEqual({ essentialDone: 0, essentialTotal: 3, allEssentialDone: false, allDone: false, next: 'account' })
  })

  it('o destaque vai para o próximo passo essencial que falta, na ordem', () => {
    expect(progress({ ...none, account: true }).next).toBe('recurring')
    expect(progress({ ...none, account: true, transaction: true }).next).toBe('recurring')
    expect(progress({ ...none, account: true, recurring: true }).next).toBe('transaction')
  })

  it('opcionais não contam para o essencial, mas contam para "tudo feito"', () => {
    const essential = { ...none, account: true, recurring: true, transaction: true }
    expect(progress(essential)).toMatchObject({ essentialDone: 3, allEssentialDone: true, allDone: false, next: null })
    expect(progress({ ...essential, card: true, goal: true }).allDone).toBe(true)
    expect(progress({ ...none, card: true, goal: true })).toMatchObject({ essentialDone: 0, allEssentialDone: false })
  })

  it('passos que precisam de conta ficam bloqueados até ela existir', () => {
    expect(isBlocked(step('recurring'), none)).toBe(true)
    expect(isBlocked(step('transaction'), none)).toBe(true)
    expect(isBlocked(step('account'), none)).toBe(false)
    expect(isBlocked(step('card'), none)).toBe(false)
    expect(isBlocked(step('recurring'), { ...none, account: true })).toBe(false)
  })
})

describe('primeiros passos: ocultar', () => {
  beforeEach(() => localStorage.clear())

  it('é guardado por usuário e pode ser desfeito', () => {
    expect(isHidden(1)).toBe(false)
    setHidden(1, true)
    expect(isHidden(1)).toBe(true)
    expect(isHidden(2)).toBe(false) // outra pessoa no mesmo aparelho continua vendo o guia
    setHidden(1, false)
    expect(isHidden(1)).toBe(false)
  })
})
