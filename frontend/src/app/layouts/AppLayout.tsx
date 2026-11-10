import { ArrowLeftRight, CreditCard, LayoutGrid, LogOut, Menu, Search, X } from 'lucide-react'
import { useState, type CSSProperties } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { NAV_ITEMS } from '@/app/navigation'
import heroUrl from '@/assets/hero-cidade.webp'
import { Brand } from '@/components/brand/Logo'
import { Avatar } from '@/components/ui/Avatar'
import { useAuth } from '@/features/auth/AuthProvider'
import { QuickActions } from '@/features/quick/QuickActions'
import { cn } from '@/lib/cn'
import { GlobalSearch } from './GlobalSearch'
import { NotificationsMenu } from './NotificationsMenu'
import { ReloadButton } from './ReloadButton'
import { UserMenu } from './UserMenu'

function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <nav aria-label="Principal" className="flex flex-col gap-1.5">
      {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
        <NavLink
          key={to}
          to={to}
          end={to === '/'}
          onClick={onNavigate}
          className={({ isActive }) =>
            cn(
              'flex min-h-12 items-center gap-4 rounded-xl px-4 text-[16px] transition-colors',
              isActive
                ? 'bg-[linear-gradient(90deg,rgb(34_197_139/0.28),rgb(34_197_139/0.08))] font-semibold text-suave-t ring-1 ring-suave/20 shadow-[0_0_24px_-10px_rgb(34_197_139/0.8)]'
                : 'text-branco/85 hover:bg-white/5 hover:text-branco',
            )
          }
        >
          <Icon aria-hidden className="size-6" strokeWidth={1.75} />
          {label}
        </NavLink>
      ))}
    </nav>
  )
}

function UserCard() {
  const { user, logout } = useAuth()
  const name = user?.first_name || user?.username || ''
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-white/8 bg-white/4 p-3">
      <Avatar name={name} size="md" online />
      <div className="min-w-0 flex-1">
        <p className="truncate text-[15px] font-semibold">{name}</p>
        <p className="truncate text-xs text-cinza-t">{user?.email || user?.username}</p>
      </div>
      <button
        type="button"
        onClick={() => void logout()}
        className="flex min-h-10 shrink-0 items-center gap-1.5 rounded-lg px-2 text-sm text-branco/85 hover:bg-white/6 hover:text-branco"
      >
        <LogOut aria-hidden className="size-4" /> Sair
      </button>
    </div>
  )
}

function SidebarBody({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <>
      <div className="flex flex-col gap-8 lg:gap-10">
        <div className="px-2">
          <Brand />
        </div>
        <SidebarNav onNavigate={onNavigate} />
      </div>
      <div className="flex flex-col gap-5">
        <UserCard />
        <p className="px-3 text-sm text-cinza-t">NEXO v{__APP_VERSION__}</p>
      </div>
    </>
  )
}

const sidebarSurface =
  'bg-[radial-gradient(28rem_22rem_at_0%_0%,rgb(34_197_139/0.16),transparent_70%),linear-gradient(180deg,#0f1a21,#0b1319)]'

/** Celular e tablet: o que mais se usa fica ao alcance do polegar; "Mais" abre o menu completo. */
const BOTTOM_ITEMS = [
  { to: '/', label: 'Início', icon: LayoutGrid },
  { to: '/transacoes', label: 'Transações', icon: ArrowLeftRight },
] as const
const BOTTOM_ITEMS_RIGHT = [{ to: '/cartoes', label: 'Cartões', icon: CreditCard }] as const

function BottomLink({ to, label, icon: Icon }: { to: string; label: string; icon: typeof LayoutGrid }) {
  return (
    <NavLink
      to={to}
      end={to === '/'}
      className={({ isActive }) =>
        cn('flex min-h-14 flex-1 flex-col items-center justify-center gap-1 rounded-xl text-[11px] font-medium', isActive ? 'text-suave-t' : 'text-branco/75 hover:text-branco')
      }
    >
      <Icon aria-hidden className="size-6" strokeWidth={1.9} />
      {label}
    </NavLink>
  )
}

export function AppLayout() {
  // A gaveta e a busca do celular fecham ao navegar (onNavigate), sem precisar de efeito.
  const [open, setOpen] = useState(false)
  const [searching, setSearching] = useState(false)

  return (
    <div className="flex min-h-full">
      {/* Foto da cidade atrás de tudo, fixa na rolagem; o resto da interface é vidro. */}
      <div aria-hidden className="app-backdrop" style={{ '--hero-image': `url("${heroUrl}")` } as CSSProperties} />

      {/* Desktop: sidebar fixa (a única superfície sólida, em degradê) */}
      <aside className={cn('sticky top-0 hidden h-screen w-[264px] shrink-0 flex-col justify-between overflow-y-auto border-r border-white/6 px-4 py-7 lg:flex', sidebarSurface)}>
        <SidebarBody />
      </aside>

      <div className="relative flex min-w-0 flex-1 flex-col">
        {/* Celular/tablet: barra superior de vidro, uma linha */}
        <header className="sticky top-0 z-20 border-b border-white/10 bg-[rgb(8_13_18/0.45)] pt-[env(safe-area-inset-top)] backdrop-blur-xl lg:hidden">
          <div className="flex h-16 items-center justify-between gap-3 px-4 sm:px-6">
            <Brand compact />
            <GlobalSearch className="hidden max-w-md flex-1 md:block" />
            <div className="flex items-center gap-0.5 sm:gap-1">
              <ReloadButton />
              <button
                type="button"
                onClick={() => setSearching((v) => !v)}
                aria-label="Buscar no sistema"
                aria-expanded={searching}
                className="flex size-11 items-center justify-center rounded-full text-branco/90 hover:bg-white/8 md:hidden"
              >
                <Search aria-hidden className="size-6" />
              </button>
              <NotificationsMenu />
              <UserMenu size="md" />
            </div>
          </div>
          {searching && (
            <div className="px-4 pb-3 md:hidden">
              <GlobalSearch autoFocus onNavigate={() => setSearching(false)} />
            </div>
          )}
        </header>

        {open && (
          <div className="fixed inset-0 z-30 lg:hidden" role="dialog" aria-modal="true" aria-label="Menu">
            <button className="absolute inset-0 bg-black/65 backdrop-blur-sm" aria-label="Fechar menu" onClick={() => setOpen(false)} />
            <div className={cn('relative flex h-full w-80 max-w-[88%] flex-col justify-between gap-6 overflow-y-auto px-4 pb-[calc(1.5rem+env(safe-area-inset-bottom))] pt-[calc(1.5rem+env(safe-area-inset-top))]', sidebarSurface)}>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Fechar menu"
                className="absolute right-3 top-5 flex size-10 items-center justify-center rounded-full text-cinza-t hover:bg-white/8 hover:text-branco"
              >
                <X aria-hidden className="size-5" />
              </button>
              <SidebarBody onNavigate={() => setOpen(false)} />
            </div>
          </div>
        )}

        {/* Celular/tablet: navegação inferior de vidro, com o "+" no centro */}
        <nav
          aria-label="Atalhos"
          className="fixed inset-x-0 bottom-0 z-20 border-t border-white/10 bg-[rgb(8_13_18/0.55)] pb-[env(safe-area-inset-bottom)] backdrop-blur-xl lg:hidden"
        >
          <div className="mx-auto flex max-w-lg items-center gap-1 px-2">
            {BOTTOM_ITEMS.map((it) => (
              <BottomLink key={it.to} {...it} />
            ))}
            <div className="flex flex-1 justify-center">
              <QuickActions variant="fab" />
            </div>
            {BOTTOM_ITEMS_RIGHT.map((it) => (
              <BottomLink key={it.to} {...it} />
            ))}
            <button
              type="button"
              onClick={() => setOpen(true)}
              aria-expanded={open}
              className="flex min-h-14 flex-1 flex-col items-center justify-center gap-1 rounded-xl text-[11px] font-medium text-branco/75 hover:text-branco"
            >
              <Menu aria-hidden className="size-6" strokeWidth={1.9} />
              Mais
            </button>
          </div>
        </nav>

        <div className="relative mx-auto w-full max-w-[1400px] flex-1 px-4 pb-32 sm:px-6 lg:px-10 lg:pb-12">
          {/* Desktop: busca, ações rápidas, notificações e conta */}
          <div className="hidden items-center justify-between gap-6 pb-6 pt-8 lg:flex">
            <GlobalSearch className="w-full max-w-[430px]" />
            <div className="flex items-center gap-3">
              <QuickActions />
              <NotificationsMenu />
              <UserMenu />
            </div>
          </div>
          <main className="pt-5 sm:pt-6 lg:pt-2">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  )
}
