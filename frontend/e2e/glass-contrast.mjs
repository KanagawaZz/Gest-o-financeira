// Contraste REAL de texto sobre vidro translúcido + foto (o axe não consegue medir esse fundo).
// Para cada elemento com texto: esconde o texto, fotografa o que ficou atrás e mede o contraste no pior
// ponto do fundo (percentil 5/95). Roda nos 4 períodos do tema cidade e no tema azul, e salva capturas.
// FASES=azul (ou manha,noite…) limita a rodada.
// Uso: E2E_PASS=... node e2e/glass-contrast.mjs <pasta>   (backend e Vite rodando)
import { mkdirSync } from 'node:fs'
import { chromium } from 'playwright'

const OUT = process.argv[2] ?? 'e2e-shots'
const BASE = process.env.BASE ?? 'http://127.0.0.1:5173'
const PASS = process.env.E2E_PASS
if (!PASS) throw new Error('Defina E2E_PASS')
mkdirSync(OUT, { recursive: true })

const PHASES = (process.env.FASES ?? 'manha,tarde,entardecer,noite,azul').split(',')
// Escolhe o visual como o usuário faz em Configurações › Aparência: um período do tema cidade, ou o tema azul.
const choose = (page, fase) =>
  page.evaluate((f) => {
    if (f === 'azul') localStorage.setItem('nexo.estilo', 'azul')
    else {
      localStorage.removeItem('nexo.estilo')
      localStorage.setItem('nexo.tema', f)
    }
  }, fase)
const ROUTES = (process.env.ROUTES ?? '/,/contas,/transacoes,/parcelamentos,/cartoes,/metas,/relatorios,/configuracoes').split(',')
const VIEWPORTS = { desktop: { width: 1366, height: 860 }, mobile: { width: 390, height: 844 } }

async function measure(page) {
  // Controle negativo: INJECT_CSS='...' injeta um estilo ruim de propósito (o verificador tem de reprovar).
  if (process.env.INJECT_CSS) await page.addStyleTag({ content: process.env.INJECT_CSS })
  const items = await page.evaluate(() => {
    const out = []
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
    const seen = new Set()
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      const el = n.parentElement
      if (!el || seen.has(el) || !n.textContent.trim()) continue
      seen.add(el)
      const cs = getComputedStyle(el)
      if (cs.visibility !== 'visible' || Number(cs.opacity) === 0 || el.closest('[aria-hidden="true"], .sr-only, dialog:not([open]), :disabled, [aria-disabled="true"]')) continue
      const svgText = el.closest('svg')
      const color = svgText ? cs.fill : cs.color
      const r = document.createRange()
      r.selectNodeContents(n)
      const b = r.getBoundingClientRect()
      if (b.width < 2 || b.height < 2 || b.bottom < 0 || b.top > innerHeight || b.right < 0 || b.left > innerWidth) continue
      out.push({ x: b.left, y: b.top, w: b.width, h: b.height, color, size: parseFloat(cs.fontSize), weight: Number(cs.fontWeight), text: n.textContent.trim().slice(0, 40) })
    }
    return out
  })
  const withText = (await page.screenshot()).toString('base64')
  await page.addStyleTag({ content: '*{color:transparent!important;-webkit-text-fill-color:transparent!important} svg text,svg tspan{fill:transparent!important}' })
  await page.waitForTimeout(80)
  const shot = (await page.screenshot()).toString('base64')
  return page.evaluate(async ({ items, shot, withText }) => {
    const load = async (b64) => {
      const img = new Image()
      img.src = `data:image/png;base64,${b64}`
      await img.decode()
      const cv = document.createElement('canvas')
      cv.width = img.width
      cv.height = img.height
      const ctx = cv.getContext('2d', { willReadFrequently: true })
      ctx.drawImage(img, 0, 0)
      return { cv, ctx }
    }
    const { cv: c, ctx: g } = await load(shot) // fundo sem o texto
    const { ctx: gt } = await load(withText) // tela como o usuário vê
    const probe = document.createElement('canvas').getContext('2d', { willReadFrequently: true })
    const rgba = (css) => { probe.clearRect(0, 0, 1, 1); probe.fillStyle = css; probe.fillRect(0, 0, 1, 1); const d = probe.getImageData(0, 0, 1, 1).data; return [d[0], d[1], d[2], d[3] / 255] }
    const lin = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4 }
    const lum = ([r, g2, b]) => 0.2126 * lin(r) + 0.7152 * lin(g2) + 0.0722 * lin(b)
    const ratio = (a, b) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)
    const fails = []
    for (const it of items) {
      const x0 = Math.max(0, Math.floor(it.x)), y0 = Math.max(0, Math.floor(it.y))
      const w = Math.min(c.width - x0, Math.ceil(it.w)), h = Math.min(c.height - y0, Math.ceil(it.h))
      if (w < 1 || h < 1) continue
      const data = g.getImageData(x0, y0, w, h).data
      const seen = gt.getImageData(x0, y0, w, h).data
      // Mede o fundo SÓ onde há letra (pixels que mudam quando o texto some), e não na caixa inteira.
      let px = []
      for (let i = 0; i < data.length; i += 4) {
        const d = Math.abs(data[i] - seen[i]) + Math.abs(data[i + 1] - seen[i + 1]) + Math.abs(data[i + 2] - seen[i + 2])
        if (d > 60) px.push([data[i], data[i + 1], data[i + 2]])
      }
      if (px.length < 8) {
        px = []
        for (let i = 0; i < data.length; i += 4 * 3) px.push([data[i], data[i + 1], data[i + 2]])
      }
      const ls = px.map(lum).sort((a, b) => a - b)
      const [tr, tg, tb, ta] = rgba(it.color)
      const median = ls[Math.floor(ls.length / 2)]
      // composição do texto (com alfa) sobre o fundo mediano
      const mid = px[Math.floor(px.length / 2)]
      const text = [tr * ta + mid[0] * (1 - ta), tg * ta + mid[1] * (1 - ta), tb * ta + mid[2] * (1 - ta)]
      const lt = lum(text)
      const worstBg = lt < median ? ls[Math.floor(ls.length * 0.05)] : ls[Math.floor(ls.length * 0.95)]
      const cr = ratio(lt, worstBg)
      const large = it.size >= 24 || (it.size >= 18.66 && it.weight >= 700)
      if (cr < (large ? 3 : 4.5)) fails.push(`${cr.toFixed(2)}:1 ${it.size}px "${it.text}"`)
    }
    return { checked: items.length, fails }
  }, { items, shot, withText })
}

const browser = await chromium.launch({ channel: 'msedge', headless: true })
const summary = {}
// Tela de login (sem autenticar), nos 4 períodos e 3 larguras.
for (const [vpName, vp] of Object.entries({ ...VIEWPORTS, tablet: { width: 768, height: 1024 } })) {
  const ctx = await browser.newContext({ viewport: vp, locale: 'pt-BR', deviceScaleFactor: 1 })
  const page = await ctx.newPage()
  for (const fase of PHASES) {
    await page.goto(`${BASE}/login`)
    await choose(page, fase)
    await page.reload()
    await page.waitForFunction(() => document.documentElement.dataset.estilo === 'azul' || document.querySelector('.backdrop-img')?.complete)
    await page.waitForTimeout(300)
    const res = await measure(page)
    summary[`login-${vpName}-${fase}`] = res.fails.length ? res.fails.slice(0, 8) : `ok (${res.checked} textos)`
  }
  await ctx.close()
}
if (process.env.LOGIN_ONLY) { await browser.close(); console.log(JSON.stringify(summary, null, 1)); process.exit(0) }
for (const [vpName, vp] of Object.entries(VIEWPORTS)) {
  // Um login por tamanho de tela (o próprio app limita 5 tentativas por minuto).
  const ctx = await browser.newContext({ viewport: vp, locale: 'pt-BR', timezoneId: 'America/Cuiaba', deviceScaleFactor: 1 })
  const page = await ctx.newPage()
  await page.goto(`${BASE}/login`)
  await page.getByLabel('Usuário').fill(process.env.E2E_USER ?? 'demo')
  await page.getByLabel('Senha').fill(PASS)
  await page.getByRole('button', { name: 'Entrar' }).click()
  await page.waitForURL(`${BASE}/`, { waitUntil: 'commit' })
  for (const fase of PHASES) {
    const routes = vpName === 'mobile' ? ['/'] : ROUTES
    for (const r of routes) {
      // o período fixado no aparelho é a mesma escolha que o usuário faz em Configurações
      await choose(page, fase)
      await page.goto(`${BASE}${r}`)
      await page.waitForLoadState('networkidle')
      await page.waitForTimeout(350)
      const name = `${vpName}-${fase}-${r === '/' ? 'dashboard' : r.slice(1)}`
      await page.screenshot({ path: `${OUT}/${name}.png` })
      const res = await measure(page)
      summary[name] = res.fails.length ? res.fails.slice(0, 8) : `ok (${res.checked} textos)`
    }
  }
  await page.evaluate(() => { localStorage.removeItem('nexo.tema'); localStorage.removeItem('nexo.estilo') })
  await ctx.close()
}
await browser.close()
console.log(JSON.stringify(summary, null, 1))
