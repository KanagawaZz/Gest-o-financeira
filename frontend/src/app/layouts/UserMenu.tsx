import { LogOut, Settings } from 'lucide-react'
import { useCallback, useId, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Avatar } from '@/components/ui/Avatar'
import { useAuth } from '@/features/auth/AuthProvider'
import { useDismiss } from '@/lib/useDismiss'

/** Avatar do canto superior: atalho para Configurações e Sair. */
export function UserMenu({ size = 'lg' }: { size?: 'md' | 'lg' }) {
  const { user, logout } = useAuth()
  const [open, setOpen] = useState(false)
  const wrap = useRef<HTMLDivElement>(null)
  const button = useRef<HTMLButtonElement>(null)
  const menuId = useId()
  const close = useCallback(() => setOpen(false), [])
  useDismiss(open, wrap, close, button)
  const name = user?.first_name || user?.username || ''

  return (
    <div ref={wrap} className="relative">
      <button
        ref={button}
        type="button"
        aria-label={`Conta de ${name}`}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen((v) => !v)}
        className="rounded-full"
      >
        <Avatar name={name} size={size} />
      </button>
      {open && (
        <div id={menuId} role="menu" aria-label="Conta" className="surface-strong absolute right-0 z-40 mt-2 w-64 overflow-hidden rounded-2xl p-1.5">
          <div className="px-3 py-2.5">
            <p className="truncate text-sm font-semibold">{name}</p>
            <p className="truncate text-xs text-cinza-t">{user?.email || user?.username}</p>
          </div>
          <Link role="menuitem" to="/configuracoes" onClick={close} className="flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm hover:bg-white/6">
            <Settings aria-hidden className="size-4 text-cinza-t" /> Configurações
          </Link>
          <button role="menuitem" type="button" onClick={() => void logout()} className="flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-left text-sm hover:bg-white/6">
            <LogOut aria-hidden className="size-4 text-cinza-t" /> Sair
          </button>
        </div>
      )}
    </div>
  )
}
