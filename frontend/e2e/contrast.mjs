// Lista as combinações de cor que reprovam no contraste (agrupadas), por rota.
import AxeBuilder from '@axe-core/playwright'
import { chromium } from 'playwright'

const BASE = process.env.BASE ?? 'http://127.0.0.1:5173'
const ROUTES = ['/', '/contas', '/transacoes', '/parcelamentos', '/cartoes', '/categorias', '/metas', '/relatorios', '/configuracoes']
const browser = await chromium.launch({ channel: 'msedge', headless: true })
const page = await (await browser.newContext({ viewport: { width: 1366, height: 820 } })).newPage()
await page.goto(`${BASE}/login`)
await page.getByLabel('Usuário').fill(process.env.E2E_USER ?? 'demo')
await page.getByLabel('Senha').fill(process.env.E2E_PASS)
await page.getByRole('button', { name: 'Entrar' }).click()
await page.waitForURL(`${BASE}/`)

const combos = new Map()
for (const r of ROUTES) {
  await page.goto(`${BASE}${r}`)
  await page.waitForLoadState('networkidle')
  const res = await new AxeBuilder({ page }).withRules(['color-contrast']).analyze()
  for (const v of res.violations)
    for (const n of v.nodes) {
      const d = n.any[0]?.data ?? {}
      const key = `${d.fgColor} on ${d.bgColor} = ${d.contrastRatio} (need ${d.expectedContrastRatio}) size ${d.fontSize}`
      const c = combos.get(key) ?? { count: 0, sample: new Set() }
      c.count++
      if (c.sample.size < 2) c.sample.add(`${r} ${n.html.slice(0, 90).replace(/\s+/g, ' ')}`)
      combos.set(key, c)
    }
}
await browser.close()
for (const [k, v] of [...combos].sort((a, b) => b[1].count - a[1].count)) console.log(v.count, '×', k, '\n    ', [...v.sample].join('\n     '))
