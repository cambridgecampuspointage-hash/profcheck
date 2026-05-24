'use client'

import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { Bell, ChevronLeft, ChevronRight, LogOut, Menu, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

export interface BrandNavItem {
  href: string
  label: string
  shortLabel?: string
  icon: React.ReactNode
}

export function BrandShell({
  children,
  navItems,
  sectionLabel,
  notificationCount = 0,
  notificationHref,
  floatingAssistant,
}: {
  children: React.ReactNode
  navItems: BrandNavItem[]
  sectionLabel: string
  notificationCount?: number
  notificationHref?: string
  floatingAssistant?: React.ReactNode
}) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [sidebarExpanded, setSidebarExpanded] = useState(true)

  const currentNav =
    navItems.find((item) => pathname === item.href || pathname.startsWith(item.href + '/')) ||
    navItems[0]

  const today = new Date().toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
  const todayFormatted = today.charAt(0).toUpperCase() + today.slice(1)

  const handleLogout = async () => {
    document.cookie = 'demo-session=; path=/; max-age=0'
    document.cookie = 'demo-role=; path=/; max-age=0'
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <div className="brand-shell">
      {sidebarOpen && <div className="brand-overlay" onClick={() => setSidebarOpen(false)} />}

      <aside className={`brand-sidebar ${sidebarExpanded ? '' : 'collapsed'} ${sidebarOpen ? 'open' : ''}`}>
        <div className="brand-sidebar-top">
          <Link href={navItems[0]?.href || '/'} className="brand-logo-block" onClick={() => setSidebarOpen(false)}>
            <Image
              src="/cambridge_campus_rabat_logo.png"
              alt="Cambridge Campus Rabat"
              width={40}
              height={40}
              className="brand-logo-image"
            />
            <div className="brand-logo-copy">
              <span className="brand-logo-title">Cambridge Campus</span>
              <span className="brand-logo-subtitle">{sectionLabel}</span>
            </div>
          </Link>

          <button
            type="button"
            className="brand-icon-btn brand-desktop-only"
            onClick={() => setSidebarExpanded((value) => !value)}
            aria-label={sidebarExpanded ? 'Réduire la barre latérale' : 'Étendre la barre latérale'}
          >
            {sidebarExpanded ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
          </button>

          <button
            type="button"
            className="brand-icon-btn brand-mobile-only"
            onClick={() => setSidebarOpen(false)}
            aria-label="Fermer le menu"
          >
            <X size={18} />
          </button>
        </div>

        <nav className="brand-nav">
          {navItems.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`brand-nav-item ${isActive ? 'active' : ''}`}
                onClick={() => setSidebarOpen(false)}
              >
                <span className="brand-nav-icon">{item.icon}</span>
                <span className="brand-nav-label">{item.label}</span>
              </Link>
            )
          })}
        </nav>

        <div className="brand-sidebar-footer">
          <div className="brand-sidebar-profile">
            <div className="brand-avatar">CC</div>
            <div className="brand-sidebar-meta">
              <span className="brand-sidebar-role">{sectionLabel}</span>
              <span className="brand-sidebar-caption">Session active sur ProfCheck</span>
            </div>
          </div>
          <button type="button" className="brand-logout" onClick={handleLogout}>
            <LogOut size={16} />
            <span>Déconnexion</span>
          </button>
        </div>
      </aside>

      <div className="brand-main">
        <header className="brand-topbar">
          <button
            type="button"
            className="brand-icon-btn brand-mobile-only"
            onClick={() => setSidebarOpen(true)}
            aria-label="Ouvrir le menu"
          >
            <Menu size={18} />
          </button>

          <div>
            <div className="brand-topbar-title">{currentNav?.label || sectionLabel}</div>
            <div className="brand-topbar-subtitle">{sectionLabel}</div>
          </div>

          <div className="brand-topbar-right">
            <span className="brand-date-pill">{todayFormatted}</span>
            {notificationHref ? (
              <Link href={notificationHref} className="brand-icon-btn brand-notification-btn" aria-label="Notifications">
                <Bell size={16} />
                {notificationCount > 0 && (
                  <span className="brand-notification-badge">
                    {notificationCount > 9 ? '9+' : notificationCount}
                  </span>
                )}
              </Link>
            ) : (
              <div className="brand-icon-btn brand-notification-btn" aria-label="Notifications">
                <Bell size={16} />
                {notificationCount > 0 && (
                  <span className="brand-notification-badge">
                    {notificationCount > 9 ? '9+' : notificationCount}
                  </span>
                )}
              </div>
            )}
          </div>
        </header>

        <main className="brand-content">{children}</main>
      </div>

      {floatingAssistant}
    </div>
  )
}
