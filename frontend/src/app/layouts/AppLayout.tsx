import { ArrowLeftRight, CreditCard, LayoutGrid, LogOut, Menu, Search, UserRound, X } from 'lucide-react'
import { useLayoutEffect, useRef, useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { NAV_ITEMS } from '@/app/navigation'
import { Backdrop } from './Backdrop'
import { Brand } from '@/components/brand/Logo'
import { Avatar } from '@/components/ui/Avatar'
import { useAuth } from '@/features/auth/AuthProvider'
import { QuickActions } from '@/features/quick/QuickActions'
import { cn } from '@/lib/cn'
import { MOTION, prefersReducedMotion } from '@/lib/motion'
import { GlobalSearch } from './GlobalSearch'
import { NotificationsMenu } from './NotificationsMenu'
import { ReloadButton } from './ReloadButton'
import { UserMenu } from './UserMenu'

function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const { pathname } = useLocation()
  const navRef = useRef<HTMLElement>(null)
  const pillRef = useRef<HTMLSpanElement>(null)

  // O destaque do item ativo é um elemento só, que desliza até o novo item (escrito direto no DOM:
  // a posição depende do layout medido, e não há estado do React para isso).
  useLayoutEffect(() => {
    const nav = navRef.current
    const pill = pillRef.current
    if (!nav || !pill) return
    const active = nav.querySelector<HTMLElement>('a[aria-current="page"]')
    if (!active) {
      pill.style.opacity = '0'
      return
    }
    pill.style.opacity = '1'
    pill.style.height = `${active.offsetHeight}px`
    pill.style.transform = `translateY(${active.offsetTop}px)`
    const id = requestAnimationFrame(() => pill.classList.add('nav-pill-ready')) // a 1ª posição não desliza
    return () => cancelAnimationFrame(id)
  }, [pathname])

  return (
    <nav ref={navRef} aria-label="Principal" className="relative flex flex-col gap-1.5">
      <span
        ref={pillRef}
        aria-hidden
        className="nav-pill nav-active pointer-events-none absolute inset-x-0 top-0 rounded-xl opacity-0"
      />
      {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
        <NavLink
          key={to}
          to={to}
          end={to === '/'}
          onClick={onNavigate}
          className={({ isActive }) =>
            cn(
              'group relative flex min-h-12 items-center gap-4 rounded-xl px-4 text-[16px] transition-[color,background-color,transform] duration-200 ease-out active:scale-[0.985]',
              isActive ? 'font-semibold text-suave-t' : 'text-branco hover:bg-linha/5',
            )
          }
        >
          <Icon aria-hidden className="size-6 transition-transform duration-200 ease-out group-hover:translate-x-0.5 group-aria-[current=page]:scale-105" strokeWidth={1.75} />
          {label}
        </NavLink>
      ))}
    </nav>
  )
}

function UserCard({ onNavigate }: { onNavigate?: () => void }) {
  const { user, logout } = useAuth()
  const raw = user?.first_name || user?.username || ''
  const name = raw.charAt(0).toUpperCase() + raw.slice(1)
  const action =
    'flex min-h-9 items-center justify-center gap-1.5 rounded-lg chip text-[13px] font-medium transition-[background-color,color,transform] duration-150 active:translate-y-px'
  return (
    <div className="profile-card rounded-2xl p-3">
      <div className="flex items-center gap-3">
        <span className="profile-ring shrink-0 rounded-full p-[2px]">
          <Avatar name={name} size="md" online ringless />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-semibold leading-tight">{name}</p>
          <p className="mt-0.5 truncate text-xs text-cinza-t" title={user?.email || undefined}>
            {user?.email || user?.username}
          </p>
        </div>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <NavLink to="/configuracoes" onClick={onNavigate} className={action}>
          <UserRound aria-hidden className="size-4" /> Meu perfil
        </NavLink>
        <button type="button" onClick={() => void logout()} className={cn(action, 'hover:text-queimado-t')}>
          <LogOut aria-hidden className="size-4" /> Sair
        </button>
      </div>
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
        <UserCard onNavigate={onNavigate} />
        <p className="px-3 text-xs text-cinza-t">NEXO v{__APP_VERSION__}</p>
      </div>
    </>
  )
}

const sidebarSurface = 'app-sidebar'

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
        cn('flex min-h-14 flex-1 flex-col items-center justify-center gap-1 rounded-xl text-[11px] font-medium', isActive ? 'text-suave-t' : 'text-branco hover:text-suave-t')
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
  const [closing, setClosing] = useState(false)
  const { pathname } = useLocation()
  const closeDrawer = () => {
    if (prefersReducedMotion()) return setOpen(false)
    setClosing(true)
    window.setTimeout(() => {
      setOpen(false)
      setClosing(false)
    }, MOTION.base - 20)
  }

  return (
    <div className="flex min-h-full">
      {/* Foto da cidade atrás de tudo, fixa na rolagem; o resto da interface é vidro. */}
      <Backdrop />

      {/* Desktop: sidebar fixa (a única superfície sólida, em degradê) */}
      <aside className={cn('sticky top-0 hidden h-screen w-[264px] shrink-0 flex-col justify-between overflow-y-auto border-r border-linha/6 px-4 py-7 lg:flex', sidebarSurface)}>
        <SidebarBody />
      </aside>

      <div className="photo-text relative flex min-w-0 flex-1 flex-col">
        {/* Celular/tablet: barra superior de vidro, uma linha */}
        <header className="sticky top-0 z-20 border-b border-linha/10 app-bar pt-[env(safe-area-inset-top)] lg:hidden">
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
                className="flex size-11 items-center justify-center rounded-full text-branco/90 hover:bg-linha/8 md:hidden"
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
            <button className={cn('absolute inset-0 bg-[var(--scrim)] backdrop-blur-[2px]', closing ? 'scrim-out' : 'scrim-in')} aria-label="Fechar menu" onClick={closeDrawer} />
            <div className={cn('relative flex h-full w-80 max-w-[88%] flex-col justify-between gap-6 overflow-y-auto px-4 pb-[calc(1.5rem+env(safe-area-inset-bottom))] pt-[calc(1.5rem+env(safe-area-inset-top))]', sidebarSurface, closing ? 'drawer-out' : 'drawer-in')}>
              <button
                type="button"
                onClick={closeDrawer}
                aria-label="Fechar menu"
                className="absolute right-3 top-5 flex size-10 items-center justify-center rounded-full text-cinza-t hover:bg-linha/8 hover:text-branco"
              >
                <X aria-hidden className="size-5" />
              </button>
              <SidebarBody onNavigate={closeDrawer} />
            </div>
          </div>
        )}

        {/* Celular/tablet: navegação inferior de vidro, com o "+" no centro */}
        <nav
          aria-label="Atalhos"
          className="fixed inset-x-0 bottom-0 z-20 border-t border-linha/10 app-bar pb-[env(safe-area-inset-bottom)] lg:hidden"
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
              className="flex min-h-14 flex-1 flex-col items-center justify-center gap-1 rounded-xl text-[11px] font-medium text-branco hover:text-suave-t"
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
            <div key={pathname} className="page-enter">
              <Outlet />
            </div>
          </main>
        </div>
      </div>
    </div>
  )
}
