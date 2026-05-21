'use client'

import { useEffect, useState } from 'react'
import { closeAttendanceSessionManually, getAttendanceSessions, getCorrectionRequests, getRooms, getTeachers, reviewCorrectionRequest, deleteAttendanceSession } from '@/lib/actions'
import { formatDate, formatDateTime, formatTime, minutesToHoursMinutes, sessionTypeLabel } from '@/lib/utils'
import type { AttendanceCorrectionRequest, AttendanceSession, Teacher, Room } from '@/lib/types'
import { CheckCircle2, Eye, Filter, Loader2, MessageSquareWarning, XCircle, Trash2 } from 'lucide-react'
import Image from 'next/image'

const correctionTypeLabels = {
  missed_start: 'Début oublié',
  missed_end: 'Fin oubliée',
  gps_issue: 'Problème GPS',
  other: 'Autre',
} as const

export default function AttendancePage() {
  const [sessions, setSessions] = useState<AttendanceSession[]>([])
  const [teachers, setTeachers] = useState<Teacher[]>([])
  const [rooms, setRooms] = useState<Room[]>([])
  const [correctionRequests, setCorrectionRequests] = useState<AttendanceCorrectionRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [reviewingId, setReviewingId] = useState<string | null>(null)
  const [closingSessionId, setClosingSessionId] = useState<string | null>(null)
  const [deletingSessionId, setDeletingSessionId] = useState<string | null>(null)
  const [signatureSession, setSignatureSession] = useState<AttendanceSession | null>(null)
  const [filters, setFilters] = useState({
    teacherId: '',
    roomId: '',
    status: '',
    dateFrom: '',
    dateTo: '',
    correctionStatus: '',
  })

  useEffect(() => {
    let active = true

    async function fetchAll() {
      const [teacherData, roomData] = await Promise.all([getTeachers(), getRooms()])
      if (!active) return
      setTeachers(teacherData as Teacher[])
      setRooms(roomData as Room[])
    }

    void fetchAll()

    return () => {
      active = false
    }
  }, [])

  const fetchSessions = async () => {
    setLoading(true)
    const [sessionData, correctionData] = await Promise.all([
      getAttendanceSessions({
        teacherId: filters.teacherId || undefined,
        roomId: filters.roomId || undefined,
        status: filters.status || undefined,
        dateFrom: filters.dateFrom || undefined,
        dateTo: filters.dateTo || undefined,
      }),
      getCorrectionRequests({
        teacherId: filters.teacherId || undefined,
        status: filters.correctionStatus || undefined,
      }),
    ])
    setSessions(sessionData as AttendanceSession[])
    setCorrectionRequests(correctionData as AttendanceCorrectionRequest[])
    setLoading(false)
  }

  useEffect(() => {
    let active = true

    async function loadInitialData() {
      const [sessionData, correctionData] = await Promise.all([
        getAttendanceSessions(),
        getCorrectionRequests(),
      ])
      if (!active) return
      setSessions(sessionData as AttendanceSession[])
      setCorrectionRequests(correctionData as AttendanceCorrectionRequest[])
      setLoading(false)
    }

    void loadInitialData()

    return () => {
      active = false
    }
  }, [])

  const getStatusBadge = (status: string) => {
    const map: Record<string, { cls: string; label: string }> = {
      active: { cls: 'badge-active', label: 'En cours' },
      completed: { cls: 'badge-completed', label: 'Terminé' },
      rejected: { cls: 'badge-rejected', label: 'Rejeté' },
      pending_review: { cls: 'badge-pending', label: 'En attente' },
    }
    const b = map[status] || { cls: '', label: status }
    return <span className={`badge ${b.cls}`}>{b.label}</span>
  }

  const reviewRequest = async (requestId: string, status: 'approved' | 'rejected') => {
    const note = window.prompt(
      status === 'approved'
        ? 'Note optionnelle pour cette approbation'
        : 'Motif du refus (optionnel)'
    ) || ''

    setReviewingId(requestId)
    const result = await reviewCorrectionRequest(requestId, status, note)
    setReviewingId(null)
    if (!result.error) {
      setCorrectionRequests((current) =>
        current.map((request) =>
          request.id === requestId
            ? {
                ...request,
                status,
                admin_notes: note || null,
                reviewed_at: new Date().toISOString(),
              }
            : request
        )
      )
    }
  }

  const closeSession = async (session: AttendanceSession) => {
    const teacherName = (session.teacher as unknown as { full_name?: string })?.full_name || 'ce professeur'
    const confirmed = window.confirm(`Clôturer maintenant la session active de ${teacherName} ?`)

    if (!confirmed) return

    setClosingSessionId(session.id)
    const result = await closeAttendanceSessionManually(session.id)
    setClosingSessionId(null)

    if (result.error) {
      window.alert(result.error)
      return
    }

    await fetchSessions()
  }

  const deleteSession = async (session: AttendanceSession) => {
    const confirmed = window.confirm('Êtes-vous sûr de vouloir supprimer définitivement cette session de pointage ? Cette action mettra à jour les calculs de paiements correspondants.')
    if (!confirmed) return

    setDeletingSessionId(session.id)
    const result = await deleteAttendanceSession(session.id)
    setDeletingSessionId(null)

    if (result.error) {
      window.alert(result.error)
      return
    }

    await fetchSessions()
  }

  return (
    <div>
      <div className="brand-page-header">
        <h1 className="brand-page-title">Pointages</h1>
        <p className="brand-page-subtitle">
          Suivi des sessions et traitement des demandes de correction.
        </p>
      </div>

      <div className="brand-card brand-card-pad" style={{ marginBottom: '1.25rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.9rem' }}>
          <Filter size={16} color="#1b2d5b" />
          <span style={{ fontWeight: 700, fontSize: '0.92rem', color: 'var(--brand-navy)' }}>Filtres</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '0.75rem' }}>
          <select className="input" value={filters.teacherId} onChange={(e) => setFilters({ ...filters, teacherId: e.target.value })}>
            <option value="">Tous les professeurs</option>
            {teachers.map((teacher) => <option key={teacher.id} value={teacher.id}>{teacher.full_name}</option>)}
          </select>
          <select className="input" value={filters.roomId} onChange={(e) => setFilters({ ...filters, roomId: e.target.value })}>
            <option value="">Toutes les salles</option>
            {rooms.map((room) => <option key={room.id} value={room.id}>{room.name}</option>)}
          </select>
          <select className="input" value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })}>
            <option value="">Tous les statuts</option>
            <option value="active">En cours</option>
            <option value="completed">Terminé</option>
            <option value="rejected">Rejeté</option>
            <option value="pending_review">En attente</option>
          </select>
          <select className="input" value={filters.correctionStatus} onChange={(e) => setFilters({ ...filters, correctionStatus: e.target.value })}>
            <option value="">Demandes: tous statuts</option>
            <option value="pending">Demandes en attente</option>
            <option value="approved">Demandes approuvées</option>
            <option value="rejected">Demandes refusées</option>
          </select>
          <input className="input" type="date" value={filters.dateFrom} onChange={(e) => setFilters({ ...filters, dateFrom: e.target.value })} />
          <input className="input" type="date" value={filters.dateTo} onChange={(e) => setFilters({ ...filters, dateTo: e.target.value })} />
          <button className="brand-staff-btn brand-staff-btn-primary" onClick={fetchSessions}>
            Rechercher
          </button>
        </div>
      </div>

      {loading ? (
        <div className="brand-card brand-card-pad" style={{ textAlign: 'center', padding: '3rem' }}>
          <Loader2 size={30} style={{ margin: '0 auto', animation: 'spin 1s linear infinite', color: 'var(--brand-gold)' }} />
        </div>
      ) : (
        <div style={{ display: 'grid', gap: '1.25rem' }}>
          <section className="brand-card">
            <div className="brand-panel-header">
              <span className="brand-panel-title">Demandes de correction</span>
              <span className="brand-panel-action">{correctionRequests.length} demande(s)</span>
            </div>

            {correctionRequests.length === 0 ? (
              <div className="brand-empty">Aucune demande de correction trouvée.</div>
            ) : (
              <div className="brand-staff-table-wrap">
                <table className="brand-staff-table">
                  <thead>
                    <tr>
                      <th>Professeur</th>
                      <th>Type</th>
                      <th>Session liée</th>
                      <th>Créée le</th>
                      <th>Statut</th>
                      <th>Commentaire</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {correctionRequests.map((request) => {
                      const teacherName = (request.teacher as unknown as { full_name?: string })?.full_name || '-'
                      const roomName = (request.session?.room as unknown as { name?: string })?.name || 'Sans session'
                      return (
                        <tr key={request.id}>
                          <td className="brand-staff-strong">{teacherName}</td>
                          <td>{correctionTypeLabels[request.request_type]}</td>
                          <td>{roomName}</td>
                          <td>{formatDateTime(request.created_at)}</td>
                          <td>
                            <span className={`brand-badge ${request.status === 'pending' ? 'warning' : request.status === 'approved' ? 'success' : 'danger'}`}>
                              {request.status === 'pending' ? 'En attente' : request.status === 'approved' ? 'Approuvée' : 'Refusée'}
                            </span>
                          </td>
                          <td style={{ maxWidth: 240 }}>
                            <div style={{ fontSize: '0.84rem' }}>{request.reason}</div>
                            {request.admin_notes && (
                              <div style={{ color: 'var(--brand-subtle)', marginTop: '0.25rem', fontSize: '0.78rem' }}>
                                Note: {request.admin_notes}
                              </div>
                            )}
                          </td>
                          <td>
                            {request.status === 'pending' ? (
                              <div className="brand-staff-actions">
                                <button
                                  className="brand-staff-icon-btn success"
                                  disabled={reviewingId === request.id}
                                  onClick={() => reviewRequest(request.id, 'approved')}
                                >
                                  <CheckCircle2 size={15} />
                                </button>
                                <button
                                  className="brand-staff-icon-btn danger"
                                  disabled={reviewingId === request.id}
                                  onClick={() => reviewRequest(request.id, 'rejected')}
                                >
                                  <XCircle size={15} />
                                </button>
                              </div>
                            ) : (
                              <span style={{ color: 'var(--brand-subtle)', fontSize: '0.82rem' }}>
                                Traité
                              </span>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="brand-card">
            <div className="brand-panel-header">
              <MessageSquareWarning size={16} color="var(--brand-muted)" />
              <span className="brand-panel-title">Sessions de pointage</span>
              <span className="brand-panel-action">{sessions.length} session(s)</span>
            </div>

            {sessions.length === 0 ? (
              <div className="brand-empty">Aucun pointage trouvé.</div>
            ) : (
              <div className="brand-staff-table-wrap">
                <table className="brand-staff-table">
                  <thead>
                    <tr>
                      <th>Professeur</th>
                      <th>Salle</th>
                      <th>Date</th>
                      <th>Type</th>
                      <th>Début</th>
                      <th>Fin</th>
                      <th>Durée réelle</th>
                      <th>Durée payée</th>
                      <th>Signature</th>
                      <th>Note séance</th>
                      <th>Statut</th>
                      <th>Raison</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sessions.map((session) => {
                      const teacherName = (session.teacher as unknown as { full_name: string })?.full_name || '-'
                      const roomName = (session.room as unknown as { name: string })?.name || '-'
                      return (
                        <tr key={session.id}>
                          <td className="brand-staff-strong">{teacherName}</td>
                          <td>{roomName}</td>
                          <td>{formatDate(session.started_at)}</td>
                          <td>{sessionTypeLabel(session.session_type)}</td>
                          <td>{formatTime(session.started_at)}</td>
                          <td>{session.ended_at ? formatTime(session.ended_at) : '-'}</td>
                          <td>{session.duration_minutes ? minutesToHoursMinutes(session.duration_minutes) : '-'}</td>
                          <td>{session.planned_duration_minutes ? minutesToHoursMinutes(session.planned_duration_minutes) : '-'}</td>
                          <td>
                            {session.signature_data_url ? (
                              <button
                                className="brand-staff-icon-btn"
                                onClick={() => setSignatureSession(session)}
                                title="Voir la signature"
                              >
                                <Eye size={15} />
                              </button>
                            ) : (
                              <span style={{ color: 'var(--brand-subtle)', fontSize: '0.8rem' }}>Aucune</span>
                            )}
                          </td>
                          <td style={{ maxWidth: 260 }}>
                            {session.teacher_notes ? (
                              <div style={{ fontSize: '0.84rem', color: 'var(--brand-navy)', whiteSpace: 'pre-wrap' }}>
                                {session.teacher_notes}
                              </div>
                            ) : (
                              <span style={{ color: 'var(--brand-subtle)', fontSize: '0.8rem' }}>—</span>
                            )}
                          </td>
                          <td>{getStatusBadge(session.status)}</td>
                          <td style={{ color: '#b24534', fontSize: '0.84rem' }}>{session.fraud_reason || '-'}</td>
                          <td>
                            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                              {session.status === 'active' ? (
                                <button
                                  className="brand-staff-btn brand-staff-btn-secondary"
                                  disabled={closingSessionId === session.id}
                                  onClick={() => closeSession(session)}
                                >
                                  {closingSessionId === session.id ? <><Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> Clôture...</> : 'Clôturer'}
                                </button>
                              ) : (
                                <span style={{ color: 'var(--brand-subtle)', fontSize: '0.82rem' }}>—</span>
                              )}
                              <button
                                className="brand-staff-icon-btn danger"
                                disabled={deletingSessionId === session.id}
                                onClick={() => deleteSession(session)}
                                title="Supprimer la session"
                              >
                                {deletingSessionId === session.id ? <Loader2 size={15} style={{ animation: 'spin 1s linear infinite' }} /> : <Trash2 size={15} />}
                              </button>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      )}

      {signatureSession ? (
        <div className="modal-overlay" onClick={() => setSignatureSession(null)}>
          <div className="brand-modal" onClick={(event) => event.stopPropagation()}>
            <div className="brand-modal-head">
              <h2 className="brand-modal-title">Signature du professeur</h2>
              <button className="brand-modal-close" onClick={() => setSignatureSession(null)}>
                <XCircle size={18} />
              </button>
            </div>

            <div style={{ display: 'grid', gap: '0.65rem', marginBottom: '1rem', color: 'var(--brand-muted)', fontSize: '0.86rem' }}>
              <div><strong style={{ color: 'var(--brand-navy)' }}>Professeur:</strong> {(signatureSession.teacher as unknown as { full_name?: string })?.full_name || '-'}</div>
              <div><strong style={{ color: 'var(--brand-navy)' }}>Salle:</strong> {(signatureSession.room as unknown as { name?: string })?.name || '-'}</div>
              <div><strong style={{ color: 'var(--brand-navy)' }}>Date:</strong> {formatDateTime(signatureSession.started_at)}</div>
              <div><strong style={{ color: 'var(--brand-navy)' }}>Type:</strong> {sessionTypeLabel(signatureSession.session_type)}</div>
            </div>

            {signatureSession.signature_data_url ? (
              <div
                style={{
                  border: '1px solid var(--brand-border)',
                  borderRadius: 18,
                  padding: '0.75rem',
                  background: 'var(--brand-paper)',
                }}
              >
                <Image
                  src={signatureSession.signature_data_url}
                  alt="Signature du professeur"
                  width={800}
                  height={320}
                  unoptimized
                  style={{ width: '100%', height: 'auto', display: 'block', borderRadius: 12, background: '#fff' }}
                />
              </div>
            ) : (
              <div className="brand-empty">Aucune signature enregistrée pour cette session.</div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  )
}
