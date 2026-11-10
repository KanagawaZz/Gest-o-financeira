import {
  ArrowLeftRight,
  CalendarRange,
  ChartColumn,
  CreditCard,
  LayoutGrid,
  ReceiptText,
  Settings,
  Tags,
  Target,
  type LucideIcon,
} from 'lucide-react'

export type NavItem = {
  to: string
  label: string
  icon: LucideIcon
}

// Ordem do menu definida no plano §3.
export const NAV_ITEMS: NavItem[] = [
  { to: '/', label: 'Dashboard', icon: LayoutGrid },
  { to: '/contas', label: 'Contas', icon: ReceiptText },
  { to: '/transacoes', label: 'Transações', icon: ArrowLeftRight },
  { to: '/parcelamentos', label: 'Parcelamentos', icon: CalendarRange },
  { to: '/cartoes', label: 'Cartões', icon: CreditCard },
  { to: '/categorias', label: 'Categorias', icon: Tags },
  { to: '/metas', label: 'Metas', icon: Target },
  { to: '/relatorios', label: 'Relatórios', icon: ChartColumn },
  { to: '/configuracoes', label: 'Configurações', icon: Settings },
]
