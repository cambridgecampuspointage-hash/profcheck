import { getTeacherHistory } from '@/lib/actions'
import { formatDate, formatTime, minutesToHoursMinutes } from '@/lib/utils'
import { History as HistoryIcon } from 'lucide-react'

export default async function TeacherHistoryPage() {
  const sessions = await getTeacherHistory()

  const getStatusBadge = (status: string) => {
    const map: Record<string, { className: string; label: string }> = {
      active: { className: 'badge-active', label: 'En cours' },
      completed: { className: 'badge-completed', label: 'Terminé' },
      rejected: { className: 'badge-rejected', label: 'Rejeté' },
      pending_review: { className: 'badge-pending', label: 'En attente' },
    }
    const badge = map[status] || { className: '', label: status }
    return <span className={`badge ${badge.className}`}>{badge.label}</span>
  }

  return (
    <div className="page-enter">
      <h1 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '1.25rem' }}>
        <HistoryIcon size={20} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 8 }} />
        Mon historique
      </h1>

      {sessions.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '2.5rem 1.5rem' }}>
          <p style={{ color: '#64748b' }}>Aucune session enregistrée.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {sessions.map((session) => {
            const roomName = (session.room as unknown as { name: string })?.name || '-'
            return (
              <div key={session.id} className="card" style={{ padding: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '0.75rem' }}>
                  <div>
                    <p style={{ fontWeight: 600, fontSize: '0.9375rem' }}>{roomName}</p>
                    <p style={{ color: '#64748b', fontSize: '0.8125rem' }}>
                      {formatDate(session.started_at)}
                    </p>
                  </div>
                  {getStatusBadge(session.status)}
                </div>
                <div style={{ display: 'flex', gap: '1.5rem', fontSize: '0.8125rem' }}>
                  <div>
                    <span style={{ color: '#94a3b8' }}>Début: </span>
                    <span style={{ fontWeight: 500 }}>{formatTime(session.started_at)}</span>
                  </div>
                  <div>
                    <span style={{ color: '#94a3b8' }}>Fin: </span>
                    <span style={{ fontWeight: 500 }}>
                      {session.ended_at ? formatTime(session.ended_at) : '-'}
                    </span>
                  </div>
                  <div>
                    <span style={{ color: '#94a3b8' }}>Durée: </span>
                    <span style={{ fontWeight: 500 }}>
                      {session.duration_minutes ? minutesToHoursMinutes(session.duration_minutes) : '-'}
                    </span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
