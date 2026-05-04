'use client'

import { useState, useEffect } from 'react'
import { getAttendanceSessions, getTeachers, getRooms } from '@/lib/actions'
import { formatDate, formatTime, minutesToHoursMinutes } from '@/lib/utils'
import type { AttendanceSession, Teacher, Room } from '@/lib/types'
import { Filter, Loader2 } from 'lucide-react'

export default function AttendancePage() {
  const [sessions, setSessions] = useState<AttendanceSession[]>([])
  const [teachers, setTeachers] = useState<Teacher[]>([])
  const [rooms, setRooms] = useState<Room[]>([])
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState({
    teacherId: '',
    roomId: '',
    status: '',
    dateFrom: '',
    dateTo: '',
  })

  useEffect(() => {
    let active = true

    const fetchAll = async () => {
      const [t, r] = await Promise.all([getTeachers(), getRooms()])
      if (!active) return
      setTeachers(t as Teacher[])
      setRooms(r as Room[])
    }

    void fetchAll()

    return () => {
      active = false
    }
  }, [])

  const fetchSessions = async () => {
    setLoading(true)
    const data = await getAttendanceSessions({
      teacherId: filters.teacherId || undefined,
      roomId: filters.roomId || undefined,
      status: filters.status || undefined,
      dateFrom: filters.dateFrom || undefined,
      dateTo: filters.dateTo || undefined,
    })
    setSessions(data as AttendanceSession[])
    setLoading(false)
  }

  useEffect(() => {
    let active = true

    async function loadSessions() {
      const data = await getAttendanceSessions()
      if (!active) return
      setSessions(data as AttendanceSession[])
      setLoading(false)
    }

    void loadSessions()

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

  return (
    <div>
      <h1 style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: '1.5rem' }}>Pointages</h1>

      {/* Filters */}
      <div className="card" style={{ marginBottom: '1.25rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
          <Filter size={16} color="#6366f1" />
          <span style={{ fontWeight: 600, fontSize: '0.875rem' }}>Filtres</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '0.75rem' }}>
          <select className="input" value={filters.teacherId} onChange={(e) => setFilters({ ...filters, teacherId: e.target.value })}>
            <option value="">Tous les professeurs</option>
            {teachers.map((t) => <option key={t.id} value={t.id}>{t.full_name}</option>)}
          </select>
          <select className="input" value={filters.roomId} onChange={(e) => setFilters({ ...filters, roomId: e.target.value })}>
            <option value="">Toutes les salles</option>
            {rooms.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
          <select className="input" value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })}>
            <option value="">Tous les statuts</option>
            <option value="active">En cours</option>
            <option value="completed">Terminé</option>
            <option value="rejected">Rejeté</option>
            <option value="pending_review">En attente</option>
          </select>
          <input className="input" type="date" value={filters.dateFrom} onChange={(e) => setFilters({ ...filters, dateFrom: e.target.value })} placeholder="Date début" />
          <input className="input" type="date" value={filters.dateTo} onChange={(e) => setFilters({ ...filters, dateTo: e.target.value })} placeholder="Date fin" />
          <button className="btn btn-primary" onClick={fetchSessions}>
            Rechercher
          </button>
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem' }}>
          <Loader2 size={32} style={{ margin: '0 auto', animation: 'spin 1s linear infinite', color: '#6366f1' }} />
        </div>
      ) : sessions.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '2.5rem', color: '#64748b' }}>
          Aucun pointage trouvé.
        </div>
      ) : (
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Professeur</th>
                <th>Salle</th>
                <th>Date</th>
                <th>Début</th>
                <th>Fin</th>
                <th>Durée</th>
                <th>Statut</th>
                <th>Raison</th>
              </tr>
            </thead>
            <tbody>
              {sessions.map((s) => {
                const teacherName = (s.teacher as unknown as { full_name: string })?.full_name || '-'
                const roomName = (s.room as unknown as { name: string })?.name || '-'
                return (
                  <tr key={s.id}>
                    <td style={{ fontWeight: 600 }}>{teacherName}</td>
                    <td>{roomName}</td>
                    <td>{formatDate(s.started_at)}</td>
                    <td>{formatTime(s.started_at)}</td>
                    <td>{s.ended_at ? formatTime(s.ended_at) : '-'}</td>
                    <td>{s.duration_minutes ? minutesToHoursMinutes(s.duration_minutes) : '-'}</td>
                    <td>{getStatusBadge(s.status)}</td>
                    <td style={{ color: '#ef4444', fontSize: '0.8125rem' }}>{s.fraud_reason || '-'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
