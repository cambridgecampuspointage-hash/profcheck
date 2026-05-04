import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Calendar, CalendarDays, Clock3, History, Play, QrCode } from 'lucide-react'
import { getTeacherStats, getUserProfile } from '@/lib/actions'

const statItems = [
  { label: "Aujourd'hui", icon: <Clock3 size={20} />, iconColor: '#1b2d5b', bgColor: '#eef1f8' },
  { label: 'Semaine', icon: <Calendar size={20} />, iconColor: '#ba7517', bgColor: '#faeeda' },
  { label: 'Mois', icon: <CalendarDays size={20} />, iconColor: '#0f6e56', bgColor: '#e1f5ee' },
]

export default async function TeacherDashboard() {
  const profile = await getUserProfile()
  if (!profile) redirect('/login')

  const stats = await getTeacherStats()
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

      <div className="brand-action-grid">
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
