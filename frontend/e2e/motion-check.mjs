// Verifica o movimento no navegador real (Edge): sequência da carga do painel, fluidez (fps e maior pausa
// entre quadros, inclusive com CPU 4× mais lenta no celular), "reduzir movimento" e modal abrindo/fechando.
// Uso: E2E_PASS=... node e2e/motion-check.mjs <pasta>   (backend e Vite rodando)
import { mkdirSync } from 'node:fs'
import { chromium } from 'playwright'

const OUT = process.argv[2] ?? 'e2e-shots'
const BASE = process.env.BASE ?? 'http://127.0.0.1:5173'
mkdirSync(OUT, { recursive: true })
const browser = await chromium.launch({ channel: 'msedge', headless: true })
const report = {}

async function login(page) {
  await page.goto(`${BASE}/login`)
  await page.getByLabel('Usuário').fill(process.env.E2E_USER ?? 'demo')
  await page.getByLabel('Senha').fill(process.env.E2E_PASS)
  await page.getByRole('button', { name: 'Entrar' }).click()
  await page.waitForURL(`${BASE}/`, { waitUntil: 'commit' })
}

// Mede os quadros durante 1,6 s a partir do momento em que os indicadores aparecem.
async function measureLoad(page, name, shots) {
  await page.evaluate(() => localStorage.setItem('nexo.tema', 'manha'))
  await page.goto(`${BASE}/transacoes`)
  await page.waitForLoadState('networkidle')
  await page.addInitScript(() => {})
  const fpsPromise = page.evaluate(
    () =>
      new Promise((resolve) => {
        const wait = () => {
          if (!document.querySelector('[aria-label="Indicadores"]')) return requestAnimationFrame(wait)
          const times = []
          const start = performance.now()
          const tick = (t) => {
            times.push(t)
            if (t - start < 1600) requestAnimationFrame(tick)
            else {
              const gaps = times.slice(1).map((v, i) => v - times[i])
              resolve({ frames: times.length, fps: Math.round((times.length / (times.at(-1) - times[0])) * 1000), worstGapMs: Math.round(Math.max(...gaps)) })
            }
          }
          requestAnimationFrame(tick)
        }
        wait()
      }),
  )
  await page.getByRole('link', { name: /Dashboard|Início/ }).first().click()
  await page.waitForSelector('[aria-label="Indicadores"]')
  const firstValue = await page.locator('[aria-label="Indicadores"] .tabular-nums').first().innerText()
  if (shots) {
    for (const ms of [120, 420]) {
      await page.waitForTimeout(ms === 120 ? 120 : 300)
      await page.screenshot({ path: `${OUT}/${name}-${ms}ms.png` })
    }
  }
  const fps = await fpsPromise
  if (shots) await page.screenshot({ path: `${OUT}/${name}-final.png` })
  const finalValue = await page.locator('[aria-label="Indicadores"] .tabular-nums').first().innerText()
  return { ...fps, firstValue: firstValue.replace(/\s/g, ' '), finalValue: finalValue.replace(/\s/g, ' ') }
}

// Desktop
{
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 860 }, locale: 'pt-BR' })
  const page = await ctx.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(String(e).slice(0, 160)))
  await login(page)
  report.desktop = await measureLoad(page, 'desktop', true)

  // Modal: abre com fade/escala e, ao fechar, o conteúdo fica visível durante a saída.
  await page.getByRole('button', { name: /^Novo/ }).first().click()
  await page.getByRole('menuitem', { name: 'Nova despesa' }).click()
  await page.waitForTimeout(60)
  const opening = await page.evaluate(() => Number(getComputedStyle(document.querySelector('dialog.modal[open]')).opacity))
  await page.waitForTimeout(400)
  await page.screenshot({ path: `${OUT}/modal-aberto.png` })
  // segue o modal que está aberto (a página tem vários <dialog> fechados)
  await page.evaluate(() => { window.__modal = document.querySelector('dialog.modal[open]') })
  await page.keyboard.press('Escape')
  await page.waitForTimeout(60)
  const midClose = await page.evaluate(() => ({ content: !!window.__modal.querySelector('form'), opacity: Number(getComputedStyle(window.__modal).opacity) }))
  await page.waitForTimeout(400)
  const closed = await page.evaluate(() => !window.__modal.querySelector('form') && getComputedStyle(window.__modal).display === 'none')
  report.modal = { opacityAos60ms: +opening.toFixed(2), conteudoDuranteSaida: midClose.content, opacityDuranteSaida: +midClose.opacity.toFixed(2), desmontadoDepois: closed }

  // Menu lateral: o destaque desliza até o novo item.
  await page.getByRole('link', { name: 'Contas' }).first().click()
  await page.waitForTimeout(40)
  const pillMid = await page.evaluate(() => getComputedStyle(document.querySelector('.nav-pill')).transform)
  await page.waitForTimeout(500)
  const pillEnd = await page.evaluate(() => getComputedStyle(document.querySelector('.nav-pill')).transform)
  report.menu = { emMovimento: pillMid !== pillEnd, pillEnd }
  report.desktopErrors = errors
  await page.evaluate(() => localStorage.removeItem('nexo.tema'))
  await ctx.close()
}

// Celular com CPU 4× mais lenta
{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true, locale: 'pt-BR' })
  const page = await ctx.newPage()
  await login(page)
  const cdp = await ctx.newCDPSession(page)
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 })
  report.celularCpu4x = await measureLoad(page, 'celular', false)
  await ctx.close()
}

// Reduzir movimento: o valor já aparece final
{
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 860 }, reducedMotion: 'reduce', locale: 'pt-BR' })
  const page = await ctx.newPage()
  await login(page)
  const r = await measureLoad(page, 'reduzido', false)
  report.reduzirMovimento = { firstValue: r.firstValue, finalValue: r.finalValue, igual: r.firstValue === r.finalValue }
  await ctx.close()
}

await browser.close()
console.log(JSON.stringify(report, null, 1))
