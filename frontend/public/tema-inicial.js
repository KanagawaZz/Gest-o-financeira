// Aplica o tema antes do React carregar, para a tela não piscar com o visual errado.
// Tema "azul" (claro e plano) não depende do horário.
// Tema "cidade": estimativa por hora (manhã 5–11h, tarde 12–16h, entardecer 17–18h, noite no resto);
// o app refina pelo sol de verdade logo em seguida.
// Arquivo externo (e não <script> inline) para respeitar a CSP de produção (script-src 'self').
;(function () {
  var fases = ['manha', 'tarde', 'entardecer', 'noite']
  var antigos = { claro: 'manha', escuro: 'noite' }
  var salvo = ''
  var estilo = 'cidade'
  try {
    salvo = localStorage.getItem('nexo.tema') || ''
    if (localStorage.getItem('nexo.estilo') === 'azul') estilo = 'azul'
  } catch {}
  var root = document.documentElement
  root.dataset.estilo = estilo
  if (estilo === 'azul') {
    root.dataset.fase = 'azul'
    root.dataset.tema = 'azul'
    return
  }
  var fase = fases.indexOf(salvo) >= 0 ? salvo : antigos[salvo]
  if (!fase) {
    var h = new Date().getHours()
    fase = h >= 5 && h < 12 ? 'manha' : h >= 12 && h < 17 ? 'tarde' : h >= 17 && h < 19 ? 'entardecer' : 'noite'
  }
  root.dataset.fase = fase
  root.dataset.tema = fase === 'noite' ? 'escuro' : 'claro'
})()
