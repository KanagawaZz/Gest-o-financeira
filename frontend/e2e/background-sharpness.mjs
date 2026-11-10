// Nitidez da foto de fundo por tela: qual arquivo o navegador escolheu e quanto ele precisa AMPLIAR a foto
// em pixels físicos do aparelho (≤ 1,00 = sem ampliação). Também confere cover (sem distorção).
// Uso: node e2e/background-sharpness.mjs [pasta-de-capturas]   (Vite rodando em :5173; não precisa de login)
import { mkdirSync } from 'node:fs'
import { chromium } from 'playwright'

const BASE = process.env.BASE ?? 'http://127.0.0.1:5173'
const OUT = process.argv[2]
if (OUT) mkdirSync(OUT, { recursive: true })

const SCREENS = [
  ['celular (iPhone)', 390, 844, 3],
  ['celular (Android)', 360, 800, 3],
  ['tablet em pé', 768, 1024, 2],
  ['tablet deitado', 1024, 768, 2],
  ['notebook 1366', 1366, 768, 1],
  ['notebook 1536 @125%', 1536, 864, 1.25],
  ['Full HD', 1920, 1080, 1],
  ['2K', 2560, 1440, 1],
  ['4K @150%', 2560, 1440, 1.5],
  ['4K @100%', 3840, 2160, 1],
  ['ultrawide', 3440, 1440, 1],
]

const browser = await chromium.launch({ channel: 'msedge', headless: true })
const rows = []
for (const [name, w, h, dpr] of SCREENS) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: dpr })
  const page = await ctx.newPage()
  await page.goto(`${BASE}/login`)
  await page.waitForFunction(() => {
    const img = document.querySelector('.backdrop-img')
    return img && img.complete && img.naturalWidth > 0
  })
  const r = await page.evaluate(async () => {
    const img = document.querySelector('.backdrop-img')
    const cs = getComputedStyle(img)
    // naturalWidth de um <img> com srcset vem "corrigido pela densidade"; os pixels reais vêm do arquivo em si.
    const file = new Image()
    file.src = img.currentSrc
    await file.decode()
    return { src: img.currentSrc.split('/').pop().replace(/-[\w-]{8}\./, '.'), nw: file.naturalWidth, nh: file.naturalHeight, cw: img.clientWidth, ch: img.clientHeight, fit: cs.objectFit }
  })
  const scale = Math.max(r.cw / r.nw, r.ch / r.nh) * dpr // ampliação em pixels físicos
  rows.push({ tela: `${name} ${w}×${h} @${dpr}x`, arquivo: `${r.src} (${r.nw}×${r.nh})`, ampliacao: `${scale.toFixed(2)}×`, cover: r.fit, ok: scale <= 1.001 })
  if (OUT) await page.screenshot({ path: `${OUT}/${name.replace(/\W+/g, '-')}.png` })
  await ctx.close()
}
await browser.close()
console.table(rows)
