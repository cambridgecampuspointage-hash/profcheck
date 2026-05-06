'use client'

import type { CSSProperties } from 'react'
import { useEffect, useState } from 'react'
import type { ReceptionProfile, StaffSchedule, WorkSchedulePayload } from '@/types/reception'
import { WEEKDAY_OPTIONS } from '@/types/reception'

export function WorkScheduleForm({
  receptionUsers,
  schedule,
  onSave,
  onClose,
}: {
  receptionUsers: ReceptionProfile[]
  schedule: StaffSchedule | null
  onSave: (payload: WorkSchedulePayload) => Promise<void>
  onClose: () => void
}) {
  const [userId, setUserId] = useState(schedule?.user_id || receptionUsers[0]?.id || '')
  const [expectedStart, setExpectedStart] = useState(schedule?.expected_start.slice(0, 5) || '09:00')
  const [expectedEnd, setExpectedEnd] = useState(schedule?.expected_end.slice(0, 5) || '18:00')
  const [maxBreakMinutes, setMaxBreakMinutes] = useState(schedule?.max_break_minutes || 60)
  const [workDays, setWorkDays] = useState<number[]>(schedule?.work_days || [0, 1, 2, 3, 4, 5])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setUserId(schedule?.user_id || receptionUsers[0]?.id || '')
      setExpectedStart(schedule?.expected_start.slice(0, 5) || '09:00')
      setExpectedEnd(schedule?.expected_end.slice(0, 5) || '18:00')
      setMaxBreakMinutes(schedule?.max_break_minutes || 60)
      setWorkDays(schedule?.work_days || [0, 1, 2, 3, 4, 5])
      setError('')
    }, 0)

    return () => window.clearTimeout(timeoutId)
  }, [receptionUsers, schedule])

  const toggleDay = (value: number) => {
    setWorkDays((current) =>
      current.includes(value)
        ? current.filter((day) => day !== value)
        : [...current, value].sort((left, right) => left - right),
    )
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!userId) {
      setError('Choisissez une réceptionniste.')
      return
    }
    if (workDays.length === 0) {
      setError('Choisissez au moins un jour de travail.')
      return
    }

    setSaving(true)
    setError('')

    try {
      await onSave({
        id: schedule?.id,
        user_id: userId,
        expected_start: expectedStart,
        expected_end: expectedEnd,
        max_break_minutes: maxBreakMinutes,
        work_days: workDays,
      })
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Enregistrement impossible.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={overlayStyle} onClick={onClose}>
      <div style={modalStyle} onClick={(event) => event.stopPropagation()}>
        <h2 style={{ margin: '0 0 1rem', color: '#1B2D5B', fontSize: '1.2rem', fontWeight: 800 }}>
          {schedule ? 'Modifier l’horaire' : 'Nouvel horaire'}
        </h2>

        {error ? <div style={errorStyle}>{error}</div> : null}

        <form onSubmit={handleSubmit} style={{ display: 'grid', gap: '1rem' }}>
          <label style={fieldStyle}>
            <span style={labelStyle}>Réceptionniste</span>
            <select value={userId} onChange={(event) => setUserId(event.target.value)} style={inputStyle}>
              {receptionUsers.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.full_name || user.email || user.id}
                </option>
              ))}
            </select>
          </label>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.8rem' }}>
            <label style={fieldStyle}>
              <span style={labelStyle}>Début</span>
              <input type="time" value={expectedStart} onChange={(event) => setExpectedStart(event.target.value)} style={inputStyle} />
            </label>
            <label style={fieldStyle}>
              <span style={labelStyle}>Fin</span>
              <input type="time" value={expectedEnd} onChange={(event) => setExpectedEnd(event.target.value)} style={inputStyle} />
            </label>
          </div>

          <label style={fieldStyle}>
            <span style={labelStyle}>Pause max (minutes)</span>
            <input
              type="number"
              min={15}
              max={120}
              value={maxBreakMinutes}
              onChange={(event) => setMaxBreakMinutes(Number(event.target.value))}
              style={inputStyle}
            />
          </label>

          <div>
            <div style={labelStyle}>Jours de travail</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.6rem', marginTop: '0.65rem' }}>
              {WEEKDAY_OPTIONS.map((day) => {
                const active = workDays.includes(day.value)
                return (
                  <button
                    key={day.value}
                    type="button"
                    onClick={() => toggleDay(day.value)}
                    style={{
                      border: '1px solid #E8E2D5',
                      background: active ? '#1B2D5B' : '#FAF8F3',
                      color: active ? '#FFFFFF' : '#1B2D5B',
                      borderRadius: 999,
                      padding: '0.55rem 0.9rem',
                      cursor: 'pointer',
                      fontWeight: 700,
                    }}
                  >
                    {day.label}
                  </button>
                )
              })}
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
            <button type="button" onClick={onClose} style={secondaryButtonStyle}>Annuler</button>
            <button type="submit" disabled={saving} style={primaryButtonStyle}>
              {saving ? 'Enregistrement...' : schedule ? 'Mettre à jour' : 'Créer l’horaire'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

const overlayStyle: CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(27, 45, 91, 0.35)',
  display: 'grid',
  placeItems: 'center',
  padding: '1rem',
  zIndex: 60,
}

const modalStyle: CSSProperties = {
  width: 'min(560px, 100%)',
  background: '#FFFFFF',
  borderRadius: 24,
  border: '1px solid #E8E2D5',
  padding: '1.25rem',
}

const fieldStyle: CSSProperties = {
  display: 'grid',
  gap: '0.45rem',
}

const labelStyle: CSSProperties = {
  color: '#1B2D5B',
  fontWeight: 700,
  fontSize: '0.86rem',
}

const inputStyle: CSSProperties = {
  border: '1px solid #E8E2D5',
  borderRadius: 14,
  padding: '0.8rem 0.9rem',
  background: '#FAF8F3',
}

const primaryButtonStyle: CSSProperties = {
  border: '1px solid #C9A84C',
  background: '#1B2D5B',
  color: '#FFFFFF',
  borderRadius: 14,
  padding: '0.75rem 1rem',
  fontWeight: 800,
  cursor: 'pointer',
}

const secondaryButtonStyle: CSSProperties = {
  border: '1px solid #E8E2D5',
  background: '#FFFFFF',
  color: '#1B2D5B',
  borderRadius: 14,
  padding: '0.75rem 1rem',
  fontWeight: 700,
  cursor: 'pointer',
}

const errorStyle: CSSProperties = {
  marginBottom: '1rem',
  background: 'rgba(229, 62, 62, 0.12)',
  border: '1px solid rgba(229, 62, 62, 0.18)',
  color: '#E53E3E',
  padding: '0.8rem 1rem',
  borderRadius: 16,
  fontWeight: 700,
}
