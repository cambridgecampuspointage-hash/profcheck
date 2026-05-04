import { Home } from 'lucide-react'
import { BrandShell, type BrandNavItem } from '@/components/brand-shell'

const navItems: BrandNavItem[] = [
  {
    href: '/reception/dashboard',
    label: 'Accueil réception',
    shortLabel: 'Accueil',
    icon: <Home size={16} />,
  },
]

export default function ReceptionLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <BrandShell navItems={navItems} sectionLabel="Espace Réception">{children}</BrandShell>
}
