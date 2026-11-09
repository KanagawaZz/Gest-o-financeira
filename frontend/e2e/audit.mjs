// Auditoria em navegador real (Edge via Playwright): login, todas as rotas em 3 larguras,
// overflow horizontal, erros de console e acessibilidade (axe-core, WCAG 2 A/AA).
// Uso: node e2e/audit.mjs <pasta-de-screenshots>   (backend em :8000 e Vite em :5173 já rodando)
import AxeBuilder from '@axe-core/playwright'
import { mkdirSync } from 'node:fs'
import { chromium } from 'playwright'

const OUT = process.argv[2] ?? 'e2e-shots'
const BASE = process.env.BASE ?? 'http://127.0.0.1:5173'
const USER = process.env.E2E_USER ?? 'demo'
const PASS = process.env.E2E_PASS
if (!PASS) throw new Error('Defina E2E_PASS')
mkdirSync(OUT, { recursive: true })

const ROUTES = [
  ['dashboard', '/'], ['contas', '/contas'], ['transacoes', '/transacoes'], ['parcelamentos', '/parcelamentos'],
  ['cartoes', '/cartoes'], ['categorias', '/categorias'], ['metas', '/metas'], ['relatorios', '/relatorios'], ['configuracoes', '/configuracoes'],
]
const VIEWPORTS = { desktop: { width: 1366, height: 820 }, tablet: { width: 768, height: 1024 }, mobile: { width: 390, height: 844 } }

const browser = await chromium.launch({ channel: 'msedge', headless: true })
const report = { overflow: [], console: [], axe: {}, failures: [] }

for (const [vpName, vp] of Object.entries(VIEWPORTS)) {
  const ctx = await browser.newContext({ viewport: vp, locale: 'pt-BR', timezoneId: 'America/Cuiaba' })
  const page = await ctx.newPage()
  page.on('console', (m) => ['error', 'warning'].includes(m.type()) && report.console.push(`[${vpName}] ${m.type()}: ${m.text().slice(0, 200)}`))
  page.on('pageerror', (e) => report.console.push(`[${vpName}] pageerror: ${String(e).slice(0, 200)}`))
  page.on('response', (r) => r.url().includes('/api/') && r.status() >= 500 && report.failures.push(`[${vpName}] ${r.status()} ${r.url()}`))

  await page.goto(`${BASE}/login`)
  await page.screenshot({ path: `${OUT}/${vpName}-login.png` })
  await page.getByLabel('Usuário').fill(USER)
  await page.getByLabel('Senha').fill(PASS)
  await page.getByRole('button', { name: 'Entrar' }).click()
  await page.waitForURL(`${BASE}/`)

  for (const [name, path] of ROUTES) {
    await page.goto(`${BASE}${path}`)
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(250)
    const ov = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }))
    if (ov.sw > ov.cw + 1) report.overflow.push(`${vpName} ${name}: scrollWidth ${ov.sw} > ${ov.cw}`)
    await page.screenshot({ path: `${OUT}/${vpName}-${name}.png`, fullPage: true })
    const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()
    for (const v of axe.violations) {
      const key = `${v.id} (${v.impact})`
      ;(report.axe[key] ??= { help: v.help, where: new Set(), nodes: 0 }).where.add(`${vpName}:${name}`)
      report.axe[key].nodes += v.nodes.length
    }
  }

  // Interações-chave
  await page.goto(`${BASE}/`)
  await page.waitForLoadState('networkidle')
  for (const tab of ['Projeção', 'Simulador']) {
    await page.getByRole('tab', { name: tab }).click()
    await page.waitForTimeout(400)
    await page.screenshot({ path: `${OUT}/${vpName}-dashboard-${tab}.png`, fullPage: true })
  }
  await page.getByRole('button', { name: /^Novo/ }).first().click()
  await page.getByRole('menuitem', { name: 'Nova despesa' }).click()
  await page.waitForTimeout(300)
  await page.screenshot({ path: `${OUT}/${vpName}-modal-despesa.png` })
  await page.keyboard.press('Escape')
  if (vpName === 'mobile') {
    await page.getByRole('button', { name: 'Abrir menu' }).click()
    await page.screenshot({ path: `${OUT}/mobile-menu.png` })
  }
  await ctx.close()
}
await browser.close()

const axe = Object.fromEntries(Object.entries(report.axe).map(([k, v]) => [k, { help: v.help, nodes: v.nodes, where: [...v.where].slice(0, 6) }]))
console.log(JSON.stringify({ overflow: report.overflow, console: [...new Set(report.console)], serverErrors: report.failures, axe }, null, 2))
