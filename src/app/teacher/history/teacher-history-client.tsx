'use client'

import { useState } from 'react'
import { createCorrectionRequest } from '@/lib/actions'
import { AiSummaryCard } from '@/components/ai/AiSummaryCard'
import type { AttendanceCorrectionRequest, AttendanceSession } from '@/lib/types'
import { formatDate, formatDateTime, formatTime, minutesToHoursMinutes } from '@/lib/utils'
import { FilePenLine, History as HistoryIcon, Loader2, X } from 'lucide-react'

const requestTypeLabels = {
  missed_start: 'Début oublié',
  missed_end: 'Fin oubliée',
  gps_issue: 'Problème GPS',
  other: 'Autre',
} as const

const requestStatusLabels = {
  pending: { label: 'En attente', className: 'warning' },
  approved: { label: 'Approuvée', className: 'success' },
  rejected: { label: 'Refusée', className: 'danger' },
} as const

export default function TeacherHistoryClient({
  initialSessions,
  initialCorrectionRequests,
}: {
  initialSessions: AttendanceSession[]
  initialCorrectionRequests: AttendanceCorrectionRequest[]
}) {
  const [correctionRequests, setCorrectionRequests] = useState(initialCorrectionRequests)
  const [showModal, setShowModal] = useState(false)
  const [selectedSession, setSelectedSession] = useState<AttendanceSession | null>(null)

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

  const openModal = (session: AttendanceSession | null = null) => {
    setSelectedSession(session)
    setShowModal(true)
  }

  return (
    <div className="page-enter">
      <div style={{ marginBottom: '1rem' }}>
        <AiSummaryCard
          title="Synthèse IA des notes prof"
          subtitle="Résumé automatique de tes dernières notes de séance et des points à signaler."
          endpoint="/api/ai/teacher-notes"
          tone="#1d4ed8"
          autoLoad={false}
          actionLabel="Générer"
        />
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
        <h1 style={{ fontSize: '1.25rem', fontWeight: 700 }}>
          <HistoryIcon size={20} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 8 }} />
          Mon historique
        </h1>
        <button className="brand-staff-btn brand-staff-btn-secondary" onClick={() => openModal()}>
          <FilePenLine size={16} />
          Nouvelle demande de correction
        </button>
      </div>

      <section style={{ marginBottom: '1.25rem' }}>
        <div className="brand-card">
          <div className="brand-panel-header">
            <span className="brand-panel-title">Demandes de correction</span>
            <span className="brand-panel-action">{correctionRequests.length} demande(s)</span>
          </div>
          {correctionRequests.length === 0 ? (
            <div className="brand-empty">Aucune demande envoyée pour le moment.</div>
          ) : (
            <div className="brand-list">
              {correctionRequests.map((request) => {
                const badge = requestStatusLabels[request.status]
                const roomName = (request.session?.room as unknown as { name?: string })?.name || 'Sans session liée'
                return (
                  <div key={request.id} className="brand-list-row" style={{ alignItems: 'flex-start' }}>
                    <div className="brand-list-avatar" style={{ background: '#eef1f8', color: '#1b2d5b' }}>
                      DC
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="brand-list-title">{requestTypeLabels[request.request_type]}</div>
                      <div className="brand-list-subtitle">
                        {roomName} · envoyée le {formatDateTime(request.created_at)}
                      </div>
                      <div style={{ marginTop: '0.35rem', color: 'var(--brand-muted)', fontSize: '0.84rem' }}>
                        {request.reason}
                      </div>
                      {(request.requested_start_at || request.requested_end_at) && (
                        <div style={{ marginTop: '0.35rem', color: 'var(--brand-subtle)', fontSize: '0.8rem' }}>
                          {request.requested_start_at ? `Début demandé: ${formatDateTime(request.requested_start_at)}` : ''}
                          {request.requested_start_at && request.requested_end_at ? ' · ' : ''}
                          {request.requested_end_at ? `Fin demandée: ${formatDateTime(request.requested_end_at)}` : ''}
                        </div>
                      )}
                      {request.admin_notes && (
                        <div style={{ marginTop: '0.45rem', color: '#7c5e1d', fontSize: '0.82rem' }}>
                          Note admin: {request.admin_notes}
                        </div>
                      )}
                    </div>
                    <span className={`brand-badge ${badge.className}`}>{badge.label}</span>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </section>

      {initialSessions.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '2.5rem 1.5rem' }}>
          <p style={{ color: '#64748b' }}>Aucune session enregistrée.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {initialSessions.map((session) => {
            const roomName = (session.room as unknown as { name: string })?.name || '-'
            return (
              <div key={session.id} className="card" style={{ padding: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '0.75rem', gap: '1rem' }}>
                  <div>
                    <p style={{ fontWeight: 600, fontSize: '0.9375rem' }}>{roomName}</p>
                    <p style={{ color: '#64748b', fontSize: '0.8125rem' }}>
                      {formatDate(session.started_at)}
                    </p>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                    {getStatusBadge(session.status)}
                    <button className="brand-staff-btn brand-staff-btn-secondary" style={{ padding: '0.55rem 0.85rem', borderRadius: 12, fontSize: '0.82rem' }} onClick={() => openModal(session)}>
                      Demander une correction
                    </button>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '1.5rem', fontSize: '0.8125rem', flexWrap: 'wrap' }}>
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
                {session.teacher_notes ? (
                  <div style={{ marginTop: '0.75rem', padding: '0.75rem 0.9rem', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 14 }}>
                    <div style={{ color: '#94a3b8', fontSize: '0.76rem', marginBottom: '0.28rem', fontWeight: 700 }}>Note de séance</div>
                    <div style={{ color: '#334155', fontSize: '0.84rem', whiteSpace: 'pre-wrap' }}>{session.teacher_notes}</div>
                  </div>
                ) : null}
              </div>
            )
          })}
        </div>
      )}

      {showModal && (
        <CorrectionRequestModal
          session={selectedSession}
          onClose={() => setShowModal(false)}
          onCreated={(request) => {
            setCorrectionRequests((current) => [request, ...current])
            setShowModal(false)
          }}
        />
      )}
    </div>
  )
}

function CorrectionRequestModal({
  session,
  onClose,
  onCreated,
}: {
  session: AttendanceSession | null
  onClose: () => void
  onCreated: (request: AttendanceCorrectionRequest) => void
}) {
  const [requestType, setRequestType] = useState<'missed_start' | 'missed_end' | 'gps_issue' | 'other'>(
    session?.status === 'active' ? 'missed_end' : 'other'
  )
  const [requestedStartAt, setRequestedStartAt] = useState('')
  const [requestedEndAt, setRequestedEndAt] = useState('')
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError('')

    const result = await createCorrectionRequest({
      session_id: session?.id,
      request_type: requestType,
      requested_start_at: requestedStartAt ? new Date(requestedStartAt).toISOString() : undefined,
      requested_end_at: requestedEndAt ? new Date(requestedEndAt).toISOString() : undefined,
      reason,
    })

    if (result.error) {
      setError(result.error)
      setSaving(false)
      return
    }

    onCreated({
      id: crypto.randomUUID(),
      teacher_id: '',
      session_id: session?.id || null,
      request_type: requestType,
      requested_start_at: requestedStartAt ? new Date(requestedStartAt).toISOString() : null,
      requested_end_at: requestedEndAt ? new Date(requestedEndAt).toISOString() : null,
      reason,
      status: 'pending',
      admin_notes: null,
      reviewed_at: null,
      created_at: new Date().toISOString(),
      session: session || undefined,
    })
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="brand-modal" onClick={(e) => e.stopPropagation()}>
        <div className="brand-modal-head">
          <h2 className="brand-modal-title">Nouvelle demande de correction</h2>
          <button className="brand-modal-close" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        {error && <div className="brand-modal-error">{error}</div>}

        <form onSubmit={handleSubmit} className="brand-modal-form">
          <div>
            <label className="brand-modal-label">Type de demande</label>
            <select className="input" value={requestType} onChange={(e) => setRequestType(e.target.value as typeof requestType)}>
              <option value="missed_start">Début oublié</option>
              <option value="missed_end">Fin oubliée</option>
              <option value="gps_issue">Problème GPS</option>
              <option value="other">Autre</option>
            </select>
          </div>

          <div>
            <label className="brand-modal-label">Début souhaité</label>
            <input className="input" type="datetime-local" value={requestedStartAt} onChange={(e) => setRequestedStartAt(e.target.value)} />
          </div>

          <div>
            <label className="brand-modal-label">Fin souhaitée</label>
            <input className="input" type="datetime-local" value={requestedEndAt} onChange={(e) => setRequestedEndAt(e.target.value)} />
          </div>

          <div>
            <label className="brand-modal-label">Explication</label>
            <textarea
              className="input"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={4}
              placeholder="Décris le problème rencontré et la correction demandée."
              required
            />
          </div>

          <button className="brand-staff-btn brand-staff-btn-primary" type="submit" disabled={saving} style={{ width: '100%' }}>
            {saving ? (
              <>
                <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />
                Envoi...
              </>
            ) : (
              'Envoyer la demande'
            )}
          </button>
        </form>
      </div>
    </div>
  )
}
