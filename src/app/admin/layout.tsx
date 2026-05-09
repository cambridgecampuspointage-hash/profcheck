import {
  BarChart3,
  CalendarDays,
  ClipboardCheck,
  Clock3,
  CreditCard,
  DoorOpen,
  GraduationCap,
  LayoutDashboard,
  MonitorSmartphone,
  Settings,
  Users,
} from 'lucide-react'
import { BrandShell, type BrandNavItem } from '@/components/brand-shell'
import { getPendingCorrectionRequestsCount } from '@/lib/actions'

const navItems: BrandNavItem[] = [
  { href: '/admin/dashboard', label: 'Tableau de bord', shortLabel: 'Dashboard', icon: <LayoutDashboard size={16} /> },
  { href: '/admin/teachers', label: 'Équipe', shortLabel: 'Équipe', icon: <Users size={16} /> },
  { href: '/dashboard/reception', label: 'Suivi réception', shortLabel: 'Suivi RH', icon: <Clock3 size={16} /> },
  { href: '/reception/dashboard', label: 'Accueil réception', shortLabel: 'Réception', icon: <MonitorSmartphone size={16} /> },
  { href: '/admin/rooms', label: 'Salles', shortLabel: 'Salles', icon: <DoorOpen size={16} /> },
  { href: '/admin/students', label: 'Étudiants', shortLabel: 'Étudiants', icon: <GraduationCap size={16} /> },
  { href: '/admin/attendance', label: 'Pointages', shortLabel: 'Pointages', icon: <ClipboardCheck size={16} /> },
  { href: '/admin/planning', label: 'Planning', shortLabel: 'Planning', icon: <CalendarDays size={16} /> },
  { href: '/admin/reports', label: 'Rapports', shortLabel: 'Rapports', icon: <BarChart3 size={16} /> },
  { href: '/admin/payments', label: 'Paiements', shortLabel: 'Paiements', icon: <CreditCard size={16} /> },
  { href: '/admin/settings', label: 'Paramètres', shortLabel: 'Réglages', icon: <Settings size={16} /> },
]

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const pendingCount = await getPendingCorrectionRequestsCount()

  return (
    <BrandShell
      navItems={navItems}
      sectionLabel="Administration"
      notificationCount={pendingCount}
      notificationHref="/admin/attendance"
    >
      {children}
    </BrandShell>
  )
}
