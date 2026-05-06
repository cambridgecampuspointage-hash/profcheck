'use client'

import { useMemo, useState } from 'react'
import { AUDIENCE_OPTIONS, DAY_LABELS, DURATION_OPTIONS, SESSION_TYPE_OPTIONS, type Audience, type DayOfWeek, type ScheduleTemplate } from '@/types/planning'
import type { Room, Teacher } from '@/lib/types'

export type TemplatePayload = {
  teacher_id: string
  day_of_week: DayOfWeek
  start_time: string
  duration_minutes: 60 | 90 | 120 | 180
  room_id: string | null
  campus_id: string
  session_type: 'group' | 'one_to_one'
  group_label: string | null
  audience: Audience | null
  subject: string | null
}

export type TemplateSavePayload = {
  templates: TemplatePayload[]
}

export function TemplateForm({
  template,
  teachers,
  rooms,
  onSave,
  onClose,
}: {
  template: ScheduleTemplate | null
  teachers: Teacher[]
  rooms: Room[]
  onSave: (data: TemplateSavePayload) => Promise<void> | void
  onClose: () => void
}) {
  const [teacherId, setTeacherId] = useState(template?.teacher_id || '')
  const [dayOfWeek, setDayOfWeek] = useState<DayOfWeek>(template?.day_of_week ?? 0)
  const [selectedDays, setSelectedDays] = useState<DayOfWeek[]>(template ? [template.day_of_week] : [])
  const [startTime, setStartTime] = useState(template?.start_time?.slice(0, 5) || '')
  const [durationMinutes, setDurationMinutes] = useState<60 | 90 | 120 | 180>(template?.duration_minutes ?? 90)
  const [roomId, setRoomId] = useState<string>(template?.room_id || '')
  const [sessionType, setSessionType] = useState<'group' | 'one_to_one'>(template?.session_type ?? 'group')
  const [groupLabel, setGroupLabel] = useState(template?.group_label || '')
  const [audience, setAudience] = useState<Audience | ''>(template?.audience || '')
  const [subject, setSubject] = useState(template?.subject || '')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const selectedRoom = useMemo(
    () => rooms.find((room) => room.id === roomId),
    [roomId, rooms]
  )

  const derivedCampusId = selectedRoom?.center_id || template?.campus_id || rooms[0]?.center_id || ''

  const toggleDay = (value: DayOfWeek) => {
    setSelectedDays((current) =>
      current.includes(value)
        ? current.filter((day) => day !== value)
        : [...current, value].sort((a, b) => a - b)
    )
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setError('')

    if (!teacherId || !startTime) {
      setError('Veuillez remplir tous les champs obligatoires.')
      return
    }

    if (!derivedCampusId) {
      setError('Veuillez choisir une salle valide pour déterminer le campus.')
      return
    }

    if (!template && selectedDays.length === 0) {
      setError('Veuillez choisir au moins un jour.')
      return
    }

    setSaving(true)
    const basePayload = {
      teacher_id: teacherId,
      start_time: startTime,
      duration_minutes: durationMinutes,
      room_id: roomId || null,
      campus_id: derivedCampusId,
      session_type: sessionType,
      group_label: groupLabel.trim() || null,
      audience: audience || null,
      subject: subject.trim() || null,
    }

    const templates = template
      ? [{ ...basePayload, day_of_week: dayOfWeek }]
      : selectedDays.map((selectedDay) => ({ ...basePayload, day_of_week: selectedDay }))

    await onSave({ templates })
    setSaving(false)
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="brand-modal" onClick={(event) => event.stopPropagation()}>
        <div className="brand-modal-head">
          <h2 className="brand-modal-title">
            {template ? 'Modifier le template' : 'Créer un template'}
          </h2>
          <button className="brand-modal-close" onClick={onClose}>✕</button>
        </div>

        {error ? <div className="brand-modal-error">{error}</div> : null}

        <form onSubmit={handleSubmit} className="brand-modal-form">
          <div>
            <label className="brand-modal-label">Professeur *</label>
            <select className="input" value={teacherId} onChange={(event) => setTeacherId(event.target.value)} required>
              <option value="">Choisir un professeur</option>
              {teachers.map((teacher) => (
                <option key={teacher.id} value={teacher.id}>
                  {teacher.full_name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="brand-modal-label">Jour *</label>
            {template ? (
              <select className="input" value={dayOfWeek} onChange={(event) => setDayOfWeek(Number(event.target.value) as DayOfWeek)}>
                {Object.entries(DAY_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            ) : (
              <div style={{ display: 'flex', gap: '0.55rem', flexWrap: 'wrap' }}>
                {Object.entries(DAY_LABELS).map(([value, label]) => {
                  const numericValue = Number(value) as DayOfWeek
                  const active = selectedDays.includes(numericValue)
                  return (
                    <button
                      key={value}
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => toggleDay(numericValue)}
                      style={{
                        borderColor: active ? 'var(--brand-navy)' : undefined,
                        background: active ? 'var(--brand-gold-soft)' : undefined,
                      }}
                    >
                      {label}
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          <div>
            <label className="brand-modal-label">Heure de début *</label>
            <input className="input" type="time" value={startTime} onChange={(event) => setStartTime(event.target.value)} required />
          </div>

          <div>
            <label className="brand-modal-label">Durée *</label>
            <div style={{ display: 'flex', gap: '0.65rem', flexWrap: 'wrap' }}>
              {DURATION_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => setDurationMinutes(option.value)}
                  style={{
                    borderColor: durationMinutes === option.value ? 'var(--brand-navy)' : undefined,
                    background: durationMinutes === option.value ? 'var(--brand-gold-soft)' : undefined,
                  }}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

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

          <div>
            <label className="brand-modal-label">Type de session *</label>
            <div style={{ display: 'flex', gap: '0.65rem', flexWrap: 'wrap' }}>
              {SESSION_TYPE_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => setSessionType(option.value)}
                  style={{
                    borderColor: sessionType === option.value ? 'var(--brand-navy)' : undefined,
                    background: sessionType === option.value ? 'var(--brand-gold-soft)' : undefined,
                  }}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="brand-modal-label">Groupe / classe</label>
            <input
              className="input"
              value={groupLabel}
              onChange={(event) => setGroupLabel(event.target.value)}
              placeholder="Ex: A2/A2+ Kids"
            />
          </div>

          <div>
            <label className="brand-modal-label">Public</label>
            <select className="input" value={audience} onChange={(event) => setAudience(event.target.value as Audience | '')}>
              <option value="">—</option>
              {AUDIENCE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="brand-modal-label">Matière</label>
            <input className="input" value={subject} onChange={(event) => setSubject(event.target.value)} />
          </div>

          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
            <button type="button" className="btn btn-secondary" onClick={onClose}>Annuler</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Enregistrement...' : template ? 'Modifier le template' : 'Créer le template'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
