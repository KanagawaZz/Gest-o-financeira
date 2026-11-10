import { RotateCw } from 'lucide-react'
import { useState } from 'react'
import { cn } from '@/lib/cn'

/**
 * Recarrega a página inteira (dados e versão nova do app). Existe porque, instalado na tela inicial
 * do iPhone, o NEXO abre sem barra do navegador e sem "puxar para atualizar".
 */
export function ReloadButton({ className }: { className?: string }) {
  const [reloading, setReloading] = useState(false)
  return (
    <button
      type="button"
      aria-label={reloading ? 'Recarregando…' : 'Recarregar página'}
      title="Recarregar página"
      disabled={reloading}
      onClick={() => {
        setReloading(true)
        window.location.reload()
      }}
      className={cn('flex size-11 items-center justify-center rounded-full text-branco/80 transition-colors hover:bg-linha/8 hover:text-branco active:bg-linha/12', className)}
    >
      <RotateCw aria-hidden className={cn('size-[22px]', reloading && 'animate-spin')} />
    </button>
  )
}
