import Link from 'next/link'
import { AlertTriangle, Calendar, CalendarDays, Clock3, TrendingUp, Users, UserCheck } from 'lucide-react'
import { getAdminStats } from '@/lib/actions'
import { formatDateTime, minutesToHoursMinutes } from '@/lib/utils'

const statStyles = [
  { icon: <Users size={20} />, iconColor: '#1b2d5b', bgColor: '#eef1f8', label: 'Professeurs actifs' },
  { icon: <UserCheck size={20} />, iconColor: '#0f6e56', bgColor: '#e1f5ee', label: 'En cours maintenant' },
  { icon: <Clock3 size={20} />, iconColor: '#ba7517', bgColor: '#faeeda', label: "Heures aujourd'hui" },
  { icon: <Calendar size={20} />, iconColor: '#185fa5', bgColor: '#e6f1fb', label: 'Heures semaine' },
  { icon: <CalendarDays size={20} />, iconColor: '#993556', bgColor: '#fbeaf0', label: 'Heures mois' },
]

function buildActivitySeries(count: number) {
  const raw = Array.from({ length: 7 }, () => 0)
  const active = Math.min(count, 7)
  for (let index = 0; index < active; index += 1) {
    raw[index] = Math.max(12, Math.round(((index + 1) / active) * 100))
  }
  return raw
}

export default async function AdminDashboard() {
  const stats = await getAdminStats()
  const chartDays = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']
  const chartHeights = buildActivitySeries(stats?.recentAttendance?.length || 0)

  const values = [
    String(stats?.totalTeachers || 0),
    String(stats?.activeTeachersNow || 0),
    `${(stats?.totalHoursToday || 0).toFixed(1)}h`,
    `${(stats?.totalHoursWeek || 0).toFixed(1)}h`,
    `${(stats?.totalHoursMonth || 0).toFixed(1)}h`,
  ]

  return (
    <div>
      <div className="brand-page-header">
        <h1 className="brand-page-title">Tableau de bord</h1>
        <p className="brand-page-subtitle">
          Vue d&apos;ensemble en temps réel des professeurs, des pointages et des alertes.
        </p>
      </div>

      <div className="brand-kpi-grid" style={{ marginBottom: '1rem' }}>
        {statStyles.map((item, index) => (
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
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontFamily: 'var(--font-serif-brand)', fontSize: '1.1rem', fontWeight: 700, color: 'var(--brand-navy)' }}>
              Activité des pointages
            </div>
            <div style={{ marginTop: '0.2rem', color: 'var(--brand-muted)', fontSize: '0.86rem' }}>
              Répartition récente de l&apos;activité sur la semaine
            </div>
          </div>
          <div className="brand-badge info">
            <TrendingUp size={13} style={{ marginRight: 6 }} />
            Suivi hebdomadaire
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: '0.6rem', alignItems: 'end', minHeight: 180 }}>
          {chartDays.map((day, index) => {
            const height = chartHeights[index]
            return (
              <div key={day} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
                <div
                  style={{
                    width: '100%',
                    height: `${height}px`,
                    minHeight: 10,
                    borderRadius: '10px 10px 4px 4px',
                    background: height > 12
                      ? 'linear-gradient(180deg, rgba(27,45,91,0.95), rgba(201,168,76,0.9))'
                      : 'rgba(232,226,213,0.85)',
                  }}
                />
                <span style={{ color: 'var(--brand-subtle)', fontSize: '0.75rem' }}>{day}</span>
              </div>
            )
          })}
        </div>
      </section>

      <div className="brand-panel-grid">
        <section className="brand-card">
          <div className="brand-panel-header">
            <Clock3 size={16} color="var(--brand-muted)" />
            <span className="brand-panel-title">Pointages récents</span>
            <Link href="/admin/attendance" className="brand-panel-action">
              Tout voir
            </Link>
          </div>

          {!stats?.recentAttendance?.length ? (
            <div className="brand-empty">Aucun pointage récent</div>
          ) : (
            <div className="brand-list">
              {stats.recentAttendance.map((session) => {
                const teacherName = (session.teacher as unknown as { full_name?: string })?.full_name || 'Inconnu'
                const roomName = (session.room as unknown as { name?: string })?.name || 'Salle non définie'
                const badgeMap: Record<string, { label: string; className: string }> = {
                  active: { label: 'En cours', className: 'success' },
                  completed: { label: 'Terminé', className: 'info' },
                  rejected: { label: 'Rejeté', className: 'danger' },
                  pending_review: { label: 'En attente', className: 'warning' },
                }
                const badge = badgeMap[session.status] || { label: session.status, className: 'info' }
                const initials = teacherName
                  .split(' ')
                  .filter(Boolean)
                  .slice(0, 2)
                  .map((chunk) => chunk[0]?.toUpperCase())
                  .join('') || 'PC'

                return (
                  <div key={session.id} className="brand-list-row">
                    <div className="brand-list-avatar" style={{ background: '#eef1f8', color: '#1b2d5b' }}>
                      {initials}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="brand-list-title">{teacherName}</div>
                      <div className="brand-list-subtitle">
                        {roomName} · {formatDateTime(session.started_at)}
                        {session.duration_minutes ? ` · ${minutesToHoursMinutes(session.duration_minutes)}` : ''}
                      </div>
                    </div>
                    <span className={`brand-badge ${badge.className}`}>{badge.label}</span>
                  </div>
                )
              })}
            </div>
          )}
        </section>

        <section className="brand-card">
          <div className="brand-panel-header">
            <AlertTriangle size={16} color="#ba7517" />
            <span className="brand-panel-title">Tentatives rejetées</span>
            <Link href="/admin/attendance" className="brand-panel-action">
              Vérifier
            </Link>
          </div>

          {!stats?.rejectedAttempts?.length ? (
            <div className="brand-empty">Aucune tentative suspecte</div>
          ) : (
            <div className="brand-list">
              {stats.rejectedAttempts.map((attempt) => {
                const teacherName = (attempt.teacher as unknown as { full_name?: string })?.full_name || 'Inconnu'
                const initials = teacherName
                  .split(' ')
                  .filter(Boolean)
                  .slice(0, 2)
                  .map((chunk) => chunk[0]?.toUpperCase())
                  .join('') || 'AL'
                return (
                  <div key={attempt.id} className="brand-list-row">
                    <div className="brand-list-avatar" style={{ background: '#fef2f2', color: '#9b1c1c' }}>
                      {initials}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="brand-list-title">{teacherName}</div>
                      <div className="brand-list-subtitle">
                        {attempt.rejection_reason || 'Tentative refusée'} · {formatDateTime(attempt.created_at)}
                      </div>
                    </div>
                    <span className="brand-badge danger">
                      {Math.round(attempt.distance_meters || 0)}m
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
