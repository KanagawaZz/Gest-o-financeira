import {
  ArrowLeftRight,
  CreditCard,
  Layers,
  LayoutDashboard,
  Settings,
  Tags,
  Target,
  BarChart3,
  Wallet,
  type LucideIcon,
} from 'lucide-react'

export type NavItem = {
  to: string
  label: string
  icon: LucideIcon
}

// Ordem do menu definida no plano §3.
export const NAV_ITEMS: NavItem[] = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/contas', label: 'Contas', icon: Wallet },
  { to: '/transacoes', label: 'Transações', icon: ArrowLeftRight },
  { to: '/parcelamentos', label: 'Parcelamentos', icon: Layers },
  { to: '/cartoes', label: 'Cartões', icon: CreditCard },
  { to: '/categorias', label: 'Categorias', icon: Tags },
  { to: '/metas', label: 'Metas', icon: Target },
  { to: '/relatorios', label: 'Relatórios', icon: BarChart3 },
  { to: '/configuracoes', label: 'Configurações', icon: Settings },
]
