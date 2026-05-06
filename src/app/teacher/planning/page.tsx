import { redirect } from 'next/navigation'
import { CalendarDays, Clock3, MapPin } from 'lucide-react'
import { getTeacherPlannedSessions, getUserProfile } from '@/lib/actions'
import { formatIsoDate, getWeekDates, getWeekStart } from '@/lib/planning/generateWeekSessions'
import { DAY_LABELS } from '@/types/planning'
import { StatusBadge } from '@/app/dashboard/planning/components/StatusBadge'

function durationLabel(minutes: number) {
  if (minutes === 60) return '1h'
  if (minutes === 90) return '1h30'
  if (minutes === 120) return '2h'
  if (minutes === 180) return '3h'
  return `${minutes} min`
}

function formatTime(value: string | null) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value.slice(0, 5)
  return date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
}

export default async function TeacherPlanningPage() {
  const profile = await getUserProfile()
  if (!profile) redirect('/login')

  const sessions = await getTeacherPlannedSessions()
  const weekDates = getWeekDates(getWeekStart(new Date()))

  return (
    <div className="page-enter">
      <div className="brand-page-header">
        <h1 className="brand-page-title">Mon planning</h1>
        <p className="brand-page-subtitle">
          Retrouve tes cours prévus de la semaine et compare le prévu avec le réel.
        </p>
      </div>

      <div className="brand-kpi-grid" style={{ marginBottom: '1rem' }}>
        <div className="brand-card brand-kpi-card">
          <div className="brand-kpi-icon" style={{ background: '#eef1f8', color: '#1b2d5b' }}>
            <CalendarDays size={20} />
          </div>
          <div className="brand-kpi-value">{sessions.length}</div>
          <div className="brand-kpi-label">Créneaux cette semaine</div>
        </div>
        <div className="brand-card brand-kpi-card">
          <div className="brand-kpi-icon" style={{ background: '#e8fff5', color: '#0f6e56' }}>
            <Clock3 size={20} />
          </div>
          <div className="brand-kpi-value">{sessions.filter((session) => session.status === 'completed').length}</div>
          <div className="brand-kpi-label">Cours terminés</div>
        </div>
      </div>

      <div style={{ display: 'grid', gap: '1rem' }}>
        {weekDates.map((date, index) => {
          const isoDate = formatIsoDate(date)
          const daySessions = sessions.filter((session) => session.scheduled_date === isoDate)

          return (
            <section key={isoDate} className="brand-card brand-card-pad">
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
                <div>
                  <div style={{ fontWeight: 800, fontSize: '1rem', color: 'var(--brand-navy)' }}>
                    {DAY_LABELS[index as keyof typeof DAY_LABELS]}
                  </div>
                  <div style={{ color: 'var(--brand-muted)', fontSize: '0.84rem', marginTop: '0.2rem' }}>
                    {date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
                  </div>
                </div>
                <span className="brand-panel-action">{daySessions.length} créneau(x)</span>
              </div>

              {daySessions.length === 0 ? (
                <div className="brand-empty" style={{ minHeight: 100 }}>
                  Aucun cours prévu ce jour.
                </div>
              ) : (
                <div style={{ display: 'grid', gap: '0.85rem' }}>
                  {daySessions.map((session) => (
                    <article key={session.id} className="brand-card" style={{ padding: '1rem', borderRadius: 18 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
                        <div>
                          <div style={{ fontWeight: 700, color: 'var(--brand-navy)' }}>
                            {session.group_label || session.subject || 'Cours planifié'}
                          </div>
                          <div style={{ color: 'var(--brand-muted)', fontSize: '0.84rem', marginTop: '0.2rem' }}>
                            {session.audience ? `${session.audience === 'kids' ? 'Kids' : session.audience === 'teens' ? 'Teens' : 'Adults'} · ` : ''}
                            {session.session_type === 'one_to_one' ? 'One-to-one' : 'Groupe'}
                          </div>
                        </div>
                        <StatusBadge status={session.status} />
                      </div>

                      <div style={{ display: 'grid', gap: '0.5rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem' }}>
                          <span style={{ color: 'var(--brand-muted)', fontSize: '0.84rem' }}>Prévu</span>
                          <span style={{ fontWeight: 600 }}>{session.start_time.slice(0, 5)} · {durationLabel(session.duration_minutes)}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem' }}>
                          <span style={{ color: 'var(--brand-muted)', fontSize: '0.84rem' }}>Réel</span>
                          <span style={{ fontWeight: 600 }}>
                            {session.linked_session
                              ? `${formatTime(session.linked_session.start_time)} → ${formatTime(session.linked_session.end_time)}`
                              : 'Pas encore pointé'}
                          </span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'center' }}>
                          <span style={{ color: 'var(--brand-muted)', fontSize: '0.84rem' }}>Salle</span>
                          <span style={{ display: 'inline-flex', gap: '0.3rem', alignItems: 'center', fontWeight: 600 }}>
                            <MapPin size={14} />
                            {session.room?.name || 'Non assignée'}
                          </span>
                        </div>
                        {session.linked_session ? (
                          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem' }}>
                            <span style={{ color: 'var(--brand-muted)', fontSize: '0.84rem' }}>Écart</span>
                            <span style={{ fontWeight: 600 }}>
                              {(session.linked_session.duration_minutes || 0) - session.duration_minutes} min
                            </span>
                          </div>
                        ) : null}
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </section>
          )
        })}
      </div>
    </div>
  )
}
