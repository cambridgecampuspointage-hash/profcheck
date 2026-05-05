import { Clock, History, LayoutDashboard, QrCode, User } from 'lucide-react'
import { BrandShell, type BrandNavItem } from '@/components/brand-shell'

const navItems: BrandNavItem[] = [
  { href: '/teacher/dashboard', label: 'Tableau de bord', shortLabel: 'Accueil', icon: <LayoutDashboard size={16} /> },
  { href: '/teacher/scan', label: 'Scanner QR', shortLabel: 'Scanner', icon: <QrCode size={16} /> },
  { href: '/teacher/current-session', label: 'Session en cours', shortLabel: 'Session', icon: <Clock size={16} /> },
  { href: '/teacher/history', label: 'Historique', shortLabel: 'Historique', icon: <History size={16} /> },
  { href: '/teacher/profile', label: 'Mon profil', shortLabel: 'Profil', icon: <User size={16} /> },
]

export default function TeacherLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <BrandShell navItems={navItems} sectionLabel="Espace Professeur">{children}</BrandShell>
}
