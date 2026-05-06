'use client'

import { useMemo, useState } from 'react'
import type { Room, Teacher } from '@/lib/types'
import { parseLocalIsoDate } from '@/lib/planning/generateWeekSessions'
import type { PlannedSession } from '@/types/planning'

type OverrideAction = 'change_teacher' | 'cancel' | 'change_time' | 'other'

export function SessionOverrideModal({
  session,
  teachers,
  rooms,
  onSave,
  onClose,
}: {
  session: PlannedSession
  teachers: Teacher[]
  rooms: Room[]
  onSave: (updates: Partial<PlannedSession>) => Promise<void> | void
  onClose: () => void
}) {
  const [action, setAction] = useState<OverrideAction>('change_teacher')
  const [teacherId, setTeacherId] = useState(session.teacher_id)
  const [reason, setReason] = useState(session.override_reason || '')
  const [startTime, setStartTime] = useState(session.start_time.slice(0, 5))
  const [durationMinutes, setDurationMinutes] = useState(session.duration_minutes)
  const [roomId, setRoomId] = useState(session.room_id || '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const dateLabel = useMemo(
    () =>
      parseLocalIsoDate(session.scheduled_date).toLocaleDateString('fr-FR', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
      }),
    [session.scheduled_date]
  )

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setError('')

    if (!reason.trim()) {
      setError('La raison est obligatoire pour un override.')
      return
    }

    const updates: Partial<PlannedSession> = {
      is_override: true,
      override_reason: reason.trim(),
      updated_at: new Date().toISOString(),
    }

    if (action === 'change_teacher') {
      updates.teacher_id = teacherId
    } else if (action === 'cancel') {
      updates.status = 'cancelled'
    } else if (action === 'change_time') {
      updates.start_time = startTime
      updates.duration_minutes = durationMinutes
    } else if (action === 'other') {
      updates.room_id = roomId || null
    }

    setSaving(true)
    await onSave(updates)
    setSaving(false)
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="brand-modal" onClick={(event) => event.stopPropagation()}>
        <div className="brand-modal-head">
          <h2 className="brand-modal-title">Modifier une occurrence</h2>
          <button className="brand-modal-close" onClick={onClose}>✕</button>
        </div>

        <div className="brand-modal-copy">
          Modifier : <strong>{session.teacher?.full_name || '—'}</strong> — <strong>{dateLabel}</strong> à{' '}
          <strong>{session.start_time.slice(0, 5)}</strong> — <strong>{session.room?.name || 'Sans salle'}</strong>
          {session.group_label ? (
            <>
              {' '}— <strong>{session.group_label}</strong>
            </>
          ) : null}
          {session.is_override ? (
            <span
              style={{
                display: 'inline-flex',
                marginLeft: '0.5rem',
                padding: '0.2rem 0.5rem',
                borderRadius: 999,
                background: 'rgba(249,115,22,0.14)',
                color: '#c2410c',
                fontWeight: 700,
                fontSize: '0.75rem',
              }}
            >
              ⚡ Déjà modifié
            </span>
          ) : null}
        </div>

        {error ? <div className="brand-modal-error">{error}</div> : null}

        <form onSubmit={handleSubmit} className="brand-modal-form">
          <div>
            <label className="brand-modal-label">Action</label>
            <div style={{ display: 'grid', gap: '0.55rem' }}>
              {[
                { key: 'change_teacher', label: '👤 Changer le prof' },
                { key: 'cancel', label: '❌ Annuler ce créneau' },
                { key: 'change_time', label: '🕐 Modifier l’heure' },
                { key: 'other', label: '📝 Autre modification' },
              ].map((option) => (
                <button
                  key={option.key}
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => setAction(option.key as OverrideAction)}
                  style={{
                    justifyContent: 'flex-start',
                    borderColor: action === option.key ? 'var(--brand-navy)' : undefined,
                    background: action === option.key ? 'var(--brand-gold-soft)' : undefined,
                  }}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          {action === 'change_teacher' ? (
            <div>
              <label className="brand-modal-label">Nouveau professeur</label>
              <select className="input" value={teacherId} onChange={(event) => setTeacherId(event.target.value)}>
                {teachers.map((teacher) => (
                  <option key={teacher.id} value={teacher.id}>
                    {teacher.full_name}
                  </option>
                ))}
              </select>
            </div>
          ) : null}

          {action === 'change_time' ? (
            <>
              <div>
                <label className="brand-modal-label">Nouvelle heure</label>
                <input className="input" type="time" value={startTime} onChange={(event) => setStartTime(event.target.value)} />
              </div>
              <div>
                <label className="brand-modal-label">Nouvelle durée</label>
                <select className="input" value={durationMinutes} onChange={(event) => setDurationMinutes(Number(event.target.value) as 60 | 90 | 120 | 180)}>
                  <option value="60">1h</option>
                  <option value="90">1h30</option>
                  <option value="120">2h</option>
                  <option value="180">3h</option>
                </select>
              </div>
            </>
          ) : null}

          {action === 'other' ? (
            <div>
              <label className="brand-modal-label">Salle</label>
              <select className="input" value={roomId} onChange={(event) => setRoomId(event.target.value)}>
                <option value="">—</option>
                {rooms.map((room) => (
                  <option key={room.id} value={room.id}>
                    {room.name}
                  </option>
                ))}
              </select>
            </div>
          ) : null}

          <div>
            <label className="brand-modal-label">Raison</label>
            <textarea
              className="input"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              rows={3}
              style={{ resize: 'vertical' }}
            />
          </div>

          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
            <button type="button" className="btn btn-secondary" onClick={onClose}>Annuler</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Enregistrement...' : 'Appliquer la modification'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
