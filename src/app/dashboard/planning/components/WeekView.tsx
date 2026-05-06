'use client'

import { AUDIENCE_OPTIONS, DAY_LABELS, type PlannedSession } from '@/types/planning'
import { formatIsoDate } from '@/lib/planning/dateUtils'
import { StatusBadge } from './StatusBadge'

function durationLabel(minutes: number) {
  if (minutes === 60) return '1h'
  if (minutes === 90) return '1h30'
  if (minutes === 120) return '2h'
  if (minutes === 180) return '3h'
  return `${minutes} min`
}

function sessionTypeLabel(type: PlannedSession['session_type']) {
  return type === 'one_to_one' ? 'One-to-one' : 'Groupe'
}

function audienceLabel(audience: PlannedSession['audience']) {
  return AUDIENCE_OPTIONS.find((option) => option.value === audience)?.label || '—'
}

function formatActualTime(value: string | null) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value.slice(0, 5)
  return date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
}

export function WeekView({
  sessions,
  weekDates,
  onOverride,
  onCancel,
  onDelete,
  loading,
}: {
  sessions: PlannedSession[]
  weekDates: Date[]
  onOverride: (session: PlannedSession) => void
  onCancel: (session: PlannedSession) => void
  onDelete: (session: PlannedSession) => void
  loading: boolean
}) {
  return (
    <div style={{ display: 'grid', gap: '1rem' }}>
      {weekDates.map((date, index) => {
        const isoDate = formatIsoDate(date)
        const daySessions = sessions
          .filter((session) => session.scheduled_date === isoDate)
          .sort((left, right) => left.start_time.localeCompare(right.start_time))

        return (
          <section key={isoDate} className="brand-card">
            <div
              style={{
                padding: '0.85rem 1rem',
                borderRadius: 18,
                background: 'linear-gradient(135deg, rgba(27,45,91,0.96), rgba(49,69,125,0.96))',
                color: '#fff',
                marginBottom: '1rem',
              }}
            >
              <div style={{ fontWeight: 800, fontSize: '1rem' }}>
                {DAY_LABELS[index as keyof typeof DAY_LABELS]}
              </div>
              <div style={{ opacity: 0.8, fontSize: '0.84rem', marginTop: '0.2rem' }}>
                {date.toLocaleDateString('fr-FR', {
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                })}
              </div>
            </div>

            {loading ? (
              <div style={{ display: 'grid', gap: '0.75rem' }}>
                {Array.from({ length: 3 }).map((_, row) => (
                  <div key={row} style={{ height: 58, borderRadius: 14, background: 'rgba(226, 220, 208, 0.35)' }} />
                ))}
              </div>
            ) : daySessions.length === 0 ? (
              <div className="brand-empty">Aucun créneau ce jour.</div>
            ) : (
              <div className="brand-staff-table-wrap">
                <table className="brand-staff-table">
                  <thead>
                    <tr>
                      <th>Heure</th>
                      <th>Prof</th>
                      <th>Groupe</th>
                      <th>Salle</th>
                      <th>Prévu</th>
                      <th>Réel</th>
                      <th>Type</th>
                      <th>Public</th>
                      <th>Statut</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {daySessions.map((session) => (
                      <tr key={session.id}>
                        <td className="brand-staff-strong">{session.start_time.slice(0, 5)}</td>
                        <td>{session.teacher?.full_name || '—'}</td>
                        <td>{session.group_label || session.subject || '—'}</td>
                        <td>{session.room?.name || '—'}</td>
                        <td>
                          <div style={{ display: 'grid', gap: '0.2rem' }}>
                            <span className="brand-staff-strong">{session.start_time.slice(0, 5)}</span>
                            <span style={{ color: 'var(--brand-muted)', fontSize: '0.78rem' }}>
                              {durationLabel(session.duration_minutes)}
                            </span>
                          </div>
                        </td>
                        <td>
                          {session.linked_session ? (
                            <div style={{ display: 'grid', gap: '0.2rem' }}>
                              <span className="brand-staff-strong">
                                {formatActualTime(session.linked_session.start_time)} → {formatActualTime(session.linked_session.end_time)}
                              </span>
                              <span style={{ color: 'var(--brand-muted)', fontSize: '0.78rem' }}>
                                {(session.linked_session.duration_minutes || 0)} min
                              </span>
                            </div>
                          ) : (
                            <span style={{ color: 'var(--brand-subtle)', fontSize: '0.8rem' }}>Pas pointé</span>
                          )}
                        </td>
                        <td>
                          <span
                            style={{
                              display: 'inline-flex',
                              padding: '0.28rem 0.65rem',
                              borderRadius: 999,
                              background: session.session_type === 'one_to_one' ? 'rgba(201,168,76,0.14)' : 'rgba(59,130,246,0.12)',
                              color: session.session_type === 'one_to_one' ? '#9a6700' : '#1d4ed8',
                              fontSize: '0.78rem',
                              fontWeight: 700,
                            }}
                          >
                            {sessionTypeLabel(session.session_type)}
                          </span>
                        </td>
                        <td>
                          {session.audience ? (
                            <span
                              style={{
                                display: 'inline-flex',
                                padding: '0.28rem 0.65rem',
                                borderRadius: 999,
                                background: 'rgba(148,163,184,0.14)',
                                color: '#475569',
                                fontSize: '0.78rem',
                                fontWeight: 700,
                              }}
                            >
                              {audienceLabel(session.audience)}
                            </span>
                          ) : '—'}
                        </td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flexWrap: 'wrap' }}>
                            <StatusBadge status={session.status} />
                            {session.is_override ? (
                              <span
                                style={{
                                  display: 'inline-flex',
                                  padding: '0.25rem 0.55rem',
                                  borderRadius: 999,
                                  background: 'rgba(249,115,22,0.14)',
                                  color: '#c2410c',
                                  fontSize: '0.72rem',
                                  fontWeight: 700,
                                }}
                              >
                                ⚡ Modifié
                              </span>
                            ) : null}
                          </div>
                        </td>
                        <td>
                          {session.status === 'scheduled' ? (
                            <div style={{ display: 'flex', gap: '0.45rem', flexWrap: 'wrap' }}>
                              <button className="btn btn-secondary btn-sm" onClick={() => onOverride(session)}>
                                Modifier
                              </button>
                              <button className="btn btn-secondary btn-sm" onClick={() => onCancel(session)}>
                                Annuler
                              </button>
                              <button className="btn btn-secondary btn-sm" style={{ borderColor: '#fecaca', color: '#b91c1c' }} onClick={() => onDelete(session)}>
                                Supprimer
                              </button>
                            </div>
                          ) : (
                            <span style={{ color: 'var(--brand-subtle)', fontSize: '0.8rem' }}>—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )
      })}
    </div>
  )
}
