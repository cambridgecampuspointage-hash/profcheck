import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Award, Calendar, CalendarDays, Clock3, History, Play, QrCode, Sparkles, Star, Trophy } from 'lucide-react'
import { getTeacherBadges, getTeacherStats, getUserProfile } from '@/lib/actions'
import type { TeacherBadge } from '@/lib/types'

const statItems = [
  { label: "Aujourd'hui", icon: <Clock3 size={20} />, iconColor: '#1b2d5b', bgColor: '#eef1f8' },
  { label: 'Semaine', icon: <Calendar size={20} />, iconColor: '#ba7517', bgColor: '#faeeda' },
  { label: 'Mois', icon: <CalendarDays size={20} />, iconColor: '#0f6e56', bgColor: '#e1f5ee' },
]

function badgeVariant(badge: TeacherBadge) {
  if (badge.tone === 'gold') return 'golden-kitty'
  if (badge.tone === 'emerald') return 'product-of-the-week'
  if (badge.tone === 'rose') return 'product-of-the-month'
  return 'product-of-the-day'
}

function badgeIcon(badge: TeacherBadge) {
  const variant = badgeVariant(badge)
  if (variant === 'golden-kitty') return <Trophy size={15} />
  if (variant === 'product-of-the-week') return <Sparkles size={15} />
  if (variant === 'product-of-the-month') return <Award size={15} />
  return <Star size={15} />
}

function badgeToneClass(tone: TeacherBadge['tone']) {
  if (tone === 'gold') return 'warning'
  if (tone === 'emerald') return 'success'
  if (tone === 'rose') return 'danger'
  return 'info'
}

export default async function TeacherDashboard() {
  const profile = await getUserProfile()
  if (!profile) redirect('/login')

  const [stats, badges] = await Promise.all([getTeacherStats(), getTeacherBadges()])
  const values = [
    `${stats?.todayHours?.toFixed(1) || '0.0'}h`,
    `${stats?.weekHours?.toFixed(1) || '0.0'}h`,
    `${stats?.monthHours?.toFixed(1) || '0.0'}h`,
  ]

  return (
    <div>
      <div className="brand-page-header">
        <h1 className="brand-page-title">
          Bonjour{profile.full_name ? `, ${profile.full_name.split(' ')[0]}` : ''}
        </h1>
        <p className="brand-page-subtitle">
          Retrouve ton pointage, tes heures et tes accès rapides depuis un seul espace.
        </p>
      </div>

      {stats?.activeSession && (
        <Link
          href="/teacher/current-session"
          className="brand-card brand-action-card"
          style={{
            marginBottom: '1rem',
            background: 'linear-gradient(135deg, #1b2d5b 0%, #31457d 70%, #c9a84c 130%)',
            color: 'white',
          }}
        >
          <div className="brand-action-icon" style={{ background: 'rgba(255,255,255,0.16)', color: 'white' }}>
            <Play size={20} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: '1rem' }}>Session en cours</div>
            <div style={{ marginTop: '0.2rem', fontSize: '0.84rem', opacity: 0.92 }}>
              {((stats.activeSession.room as unknown as { name?: string })?.name) || 'Salle'} · commencé à{' '}
              {new Date(stats.activeSession.started_at).toLocaleTimeString('fr-FR', {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </div>
          </div>
          <div className="brand-badge" style={{ background: 'rgba(255,255,255,0.18)', color: 'white' }}>
            Ouvrir
          </div>
        </Link>
      )}

      <div className="brand-kpi-grid" style={{ marginBottom: '1rem' }}>
        {statItems.map((item, index) => (
          <div key={item.label} className="brand-card brand-kpi-card">
            <div className="brand-kpi-icon" style={{ background: item.bgColor, color: item.iconColor }}>
              {item.icon}
            </div>
            <div className="brand-kpi-value">{values[index]}</div>
            <div className="brand-kpi-label">{item.label}</div>
          </div>
        ))}
      </div>

      <section className="brand-card brand-card-pad" style={{ marginBottom: '1rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'center', marginBottom: '0.9rem', flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontFamily: 'var(--font-serif-brand)', color: 'var(--brand-navy)', fontSize: '1.1rem', fontWeight: 700 }}>
              Mes badges
            </div>
            <div style={{ color: 'var(--brand-muted)', fontSize: '0.84rem', marginTop: '0.2rem' }}>
              Distinctions gagnees selon ton rythme, ta fiabilite et ta discipline.
            </div>
          </div>
          <span className="brand-panel-action">{badges.length} badge(s)</span>
        </div>

        {badges.length === 0 ? (
          <div className="brand-empty" style={{ minHeight: 120 }}>
            Continue tes sessions pour debloquer tes premieres distinctions.
          </div>
        ) : (
          <div className="brand-list">
            {badges.map((badge) => (
              <div
                key={badge.id}
                className="brand-list-row"
                style={{ alignItems: 'flex-start', paddingBlock: '0.9rem' }}
              >
                <div
                  className="brand-list-avatar"
                  style={{
                    background: badge.tone === 'gold' ? '#faeeda' : badge.tone === 'emerald' ? '#e1f5ee' : badge.tone === 'rose' ? '#fef2f2' : '#e6f1fb',
                    color: badge.tone === 'gold' ? '#ba7517' : badge.tone === 'emerald' ? '#0f6e56' : badge.tone === 'rose' ? '#9b1c1c' : '#185fa5',
                  }}
                >
                  {badgeIcon(badge)}
                </div>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div className="brand-list-title">{badge.name}</div>
                  <div className="brand-list-subtitle">{badge.description}</div>
                </div>
                <span className={`brand-badge ${badgeToneClass(badge.tone)}`}>
                  Distinction
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      <div className="brand-action-grid">
        <Link href="/teacher/planning" className="brand-card brand-action-card">
          <div className="brand-action-icon" style={{ background: '#eef1f8', color: '#1b2d5b' }}>
            <CalendarDays size={22} />
          </div>
          <div>
            <div className="brand-action-title">Voir mon planning</div>
            <div className="brand-action-copy">Consulte les créneaux prévus et le prévu vs réel</div>
          </div>
        </Link>

        <Link href="/teacher/scan" className="brand-card brand-action-card">
          <div className="brand-action-icon" style={{ background: '#eef1f8', color: '#1b2d5b' }}>
            <QrCode size={22} />
          </div>
          <div>
            <div className="brand-action-title">Scanner le QR code</div>
            <div className="brand-action-copy">Démarre ou termine un cours avec la caméra</div>
          </div>
        </Link>

        <Link href="/teacher/history" className="brand-card brand-action-card">
          <div className="brand-action-icon" style={{ background: '#faeeda', color: '#ba7517' }}>
            <History size={22} />
          </div>
          <div>
            <div className="brand-action-title">Voir mon historique</div>
            <div className="brand-action-copy">Retrouve tes sessions passées et tes heures</div>
          </div>
        </Link>
      </div>
    </div>
  )
}
