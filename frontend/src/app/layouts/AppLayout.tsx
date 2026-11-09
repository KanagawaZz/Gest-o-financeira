import { LogOut, Menu, X } from 'lucide-react'
import { useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { NAV_ITEMS } from '@/app/navigation'
import { Button } from '@/components/ui/Button'
import { useAuth } from '@/features/auth/AuthProvider'
import { QuickActions } from '@/features/quick/QuickActions'
import { cn } from '@/lib/cn'

function Brand() {
  return (
    <div className="flex items-baseline gap-2 px-3">
      <span className="text-xl font-semibold tracking-wide">NEXO</span>
      <span className="text-xs text-cinza-t">Meu Financeiro</span>
    </div>
  )
}

function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <nav aria-label="Principal" className="flex flex-col gap-1">
      {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
        <NavLink
          key={to}
          to={to}
          end={to === '/'}
          onClick={onNavigate}
          className={({ isActive }) =>
            cn(
              'flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm transition-colors',
              isActive ? 'bg-suave/20 font-medium text-branco' : 'text-cinza-t hover:bg-white/5 hover:text-branco',
            )
          }
        >
          <Icon aria-hidden className="size-5" />
          {label}
        </NavLink>
      ))}
    </nav>
  )
}

function UserBox() {
  const { user, logout } = useAuth()
  return (
    <div className="flex items-center justify-between gap-2 border-t border-white/10 px-3 pt-4">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium">{user?.first_name || user?.username}</p>
        <p className="truncate text-xs text-cinza-t">{user?.email || user?.username}</p>
      </div>
      <Button variant="ghost" onClick={() => void logout()} aria-label="Sair" className="px-3">
        <LogOut aria-hidden className="size-4" />
        <span className="hidden xl:inline">Sair</span>
      </Button>
    </div>
  )
}

export function AppLayout() {
  // A gaveta fecha ao navegar (onNavigate nos links), sem precisar de efeito.
  const [open, setOpen] = useState(false)

  return (
    <div className="flex min-h-full">
      {/* Desktop: sidebar fixa */}
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col justify-between border-r border-white/8 bg-aco px-3 py-6 lg:flex">
        <div className="flex flex-col gap-8">
          <Brand />
          <SidebarNav />
        </div>
        <UserBox />
      </aside>

      {/* Tablet/celular: barra superior + gaveta */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex items-center justify-between border-b border-white/8 bg-marinho/95 px-4 py-3 lg:hidden">
          <Brand />
          <div className="flex items-center gap-2">
            <QuickActions />
            <Button variant="ghost" onClick={() => setOpen(true)} aria-label="Abrir menu" aria-expanded={open}>
              <Menu aria-hidden className="size-5" />
            </Button>
          </div>
        </header>

        {open && (
          <div className="fixed inset-0 z-30 lg:hidden" role="dialog" aria-modal="true" aria-label="Menu">
            <button className="absolute inset-0 bg-black/60" aria-label="Fechar menu" onClick={() => setOpen(false)} />
            <div className="relative flex h-full w-72 max-w-[85%] flex-col justify-between bg-aco px-3 py-5">
              <div className="flex flex-col gap-6">
                <div className="flex items-center justify-between">
                  <Brand />
                  <Button variant="ghost" onClick={() => setOpen(false)} aria-label="Fechar menu">
                    <X aria-hidden className="size-5" />
                  </Button>
                </div>
                <SidebarNav onNavigate={() => setOpen(false)} />
              </div>
              <UserBox />
            </div>
          </div>
        )}

        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-10">
          <div className="mb-6 hidden justify-end lg:flex">
            <QuickActions />
          </div>
          <Outlet />
        </main>
      </div>
    </div>
  )
}
