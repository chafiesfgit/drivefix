import {
  Bell,
  CalendarCheck,
  CalendarDays,
  ClipboardList,
  FileText,
  Gauge,
  History,
  LayoutDashboard,
  ListChecks,
  MessageSquareText,
  Package,
  Radio,
  Receipt,
  Search,
  Settings,
  ShieldCheck,
  Siren,
  Star,
  Truck,
  User,
  Users,
  Wrench,
  type LucideIcon,
} from 'lucide-react'
import type { Role } from './roles'

export interface NavItem {
  to: string
  /** i18n key under nav.* */
  label: string
  icon: LucideIcon
  end?: boolean
}

export const ROLE_NAV: Record<Role, NavItem[]> = {
  DRIVER: [
    { to: '/app/driver', label: 'dashboard', icon: LayoutDashboard, end: true },
    { to: '/app/driver/parts', label: 'parts', icon: Search },
    { to: '/app/driver/mechanics', label: 'mechanics', icon: Wrench },
    { to: '/app/driver/sos', label: 'sos', icon: Siren },
    { to: '/app/driver/orders', label: 'orders', icon: Package },
    { to: '/app/driver/bookings', label: 'bookings', icon: CalendarCheck },
    { to: '/app/driver/payments', label: 'payments', icon: Receipt },
    { to: '/app/driver/profile', label: 'profile', icon: User },
  ],
  SUPPLIER: [
    { to: '/app/supplier', label: 'dashboard', icon: LayoutDashboard, end: true },
    { to: '/app/supplier/offers', label: 'offers', icon: ListChecks },
    { to: '/app/supplier/orders', label: 'orders', icon: Package },
    { to: '/app/supplier/reviews', label: 'reviews', icon: Star },
    { to: '/app/supplier/profile', label: 'profile', icon: User },
  ],
  MECHANIC: [
    { to: '/app/mechanic', label: 'dashboard', icon: LayoutDashboard, end: true },
    { to: '/app/mechanic/requests', label: 'requests', icon: ClipboardList },
    { to: '/app/mechanic/schedule', label: 'schedule', icon: CalendarDays },
    { to: '/app/mechanic/services', label: 'services', icon: Wrench },
    { to: '/app/mechanic/reviews', label: 'reviews', icon: Star },
    { to: '/app/mechanic/profile', label: 'garage', icon: User },
  ],
  TOW_DRIVER: [
    { to: '/app/tow', label: 'dashboard', icon: Gauge, end: true },
    { to: '/app/tow/history', label: 'history', icon: History },
    { to: '/app/tow/profile', label: 'profile', icon: User },
  ],
  DISPATCHER: [
    { to: '/app/dispatcher', label: 'board', icon: Radio, end: true },
    { to: '/app/dispatcher/fleet', label: 'fleet', icon: Truck },
  ],
  ADMIN: [
    { to: '/app/admin', label: 'overview', icon: LayoutDashboard, end: true },
    { to: '/app/admin/approvals', label: 'approvals', icon: ShieldCheck },
    { to: '/app/admin/users', label: 'users', icon: Users },
    { to: '/app/admin/moderation', label: 'moderation', icon: MessageSquareText },
    { to: '/app/admin/payments', label: 'payments', icon: Receipt },
    { to: '/app/admin/fleet', label: 'fleet', icon: Truck },
    { to: '/app/admin/sms', label: 'sms', icon: Bell },
    { to: '/app/admin/reports', label: 'reports', icon: FileText },
    { to: '/app/admin/settings', label: 'settings', icon: Settings },
  ],
}
