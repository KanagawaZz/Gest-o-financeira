import type { Onboarding } from '@/types/planning'

export type StepKey = keyof Onboarding['steps']

/** Chave no cache: começa com 'dashboard', então qualquer cadastro que atualiza o painel atualiza o guia. */
export const onboardingKey = ['dashboard', 'onboarding'] as const

export type StepDef = {
  key: StepKey
  title: string
  /** O que é, em linguagem do dia a dia. */
  what: string
  action: string
  to: string
  optional: boolean
  /** Passo que precisa estar feito antes (sem conta não há onde lançar). */
  needs?: StepKey
}

/** Ordem em que alguém novo deve configurar o NEXO: do que sustenta todo o resto para o que é opcional. */
export const STEPS: StepDef[] = [
  {
    key: 'account',
    title: 'Cadastre onde seu dinheiro fica',
    what: 'Conta do banco, carteira ou poupança. Informe o saldo de hoje: é a partir dele que o NEXO calcula todo o resto.',
    action: 'Cadastrar conta',
    to: '/contas?aba=contas',
    optional: false,
  },
  {
    key: 'recurring',
    title: 'Cadastre o que se repete todo mês',
    what: 'Salário, aluguel, internet, mensalidades. Você cadastra uma vez e o NEXO lança os próximos meses e avisa dos vencimentos.',
    action: 'Cadastrar compromisso',
    to: '/contas',
    optional: false,
    needs: 'account',
  },
  {
    key: 'transaction',
    title: 'Registre o que entra e sai',
    what: 'Cada gasto ou recebimento do dia a dia (mercado, combustível, um extra). O botão + registra em segundos.',
    action: 'Registrar movimentação',
    to: '/transacoes',
    optional: false,
    needs: 'account',
  },
  {
    key: 'card',
    title: 'Cartão de crédito',
    what: 'As compras entram na fatura e só saem do seu saldo quando você paga a fatura. O NEXO controla o limite e as parcelas.',
    action: 'Cadastrar cartão',
    to: '/cartoes',
    optional: true,
  },
  {
    key: 'goal',
    title: 'Metas',
    what: 'Um objetivo com valor e prazo, como uma viagem ou uma reserva. O NEXO mostra quanto guardar por mês.',
    action: 'Criar meta',
    to: '/metas',
    optional: true,
  },
]

export type Progress = {
  essentialDone: number
  essentialTotal: number
  allEssentialDone: boolean
  allDone: boolean
  /** Próximo passo essencial a fazer (o que recebe destaque). */
  next: StepKey | null
}

export function progress(done: Onboarding['steps']): Progress {
  const essential = STEPS.filter((s) => !s.optional)
  const essentialDone = essential.filter((s) => done[s.key]).length
  return {
    essentialDone,
    essentialTotal: essential.length,
    allEssentialDone: essentialDone === essential.length,
    allDone: STEPS.every((s) => done[s.key]),
    next: essential.find((s) => !done[s.key])?.key ?? null,
  }
}

/** Um passo fica bloqueado enquanto o passo de que depende não foi feito. */
export function isBlocked(step: StepDef, done: Onboarding['steps']): boolean {
  return !!step.needs && !done[step.needs] && !done[step.key]
}

// "Ocultar" é uma preferência de tela, guardada por usuário neste aparelho (nenhum dado financeiro).
const hiddenKey = (userId: number) => `nexo.primeiros-passos.oculto.${userId}`

export function isHidden(userId: number): boolean {
  try {
    return localStorage.getItem(hiddenKey(userId)) === '1'
  } catch {
    return false
  }
}

export function setHidden(userId: number, hidden: boolean): void {
  try {
    if (hidden) localStorage.setItem(hiddenKey(userId), '1')
    else localStorage.removeItem(hiddenKey(userId))
  } catch {
    /* armazenamento bloqueado (aba privada): o guia só volta a aparecer */
  }
}
