'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { manuallyCompletePlannedSession } from '@/lib/actions'
import type { Room, Teacher } from '@/lib/types'
import { generateWeekSessions } from '@/lib/planning/generateWeekSessions'
import { formatIsoDate, formatWeekLabel, getWeekDates, getWeekStart } from '@/lib/planning/dateUtils'
import { DAY_LABELS, type PlannedSession, type ScheduleTemplate } from '@/types/planning'
import { SessionOverrideModal } from './components/SessionOverrideModal'
import { TemplateForm, type TemplatePayload, type TemplateSavePayload } from './components/TemplateForm'
import { WeekView } from './components/WeekView'

type ViewMode = 'week' | 'templates'

function formatCompactWeekRange(weekStart: Date) {
  const dates = getWeekDates(weekStart)
  const start = dates[0]
  const end = dates[5]
  return `${start.getDate()} – ${end.getDate()} ${end.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}`
}

function timeToMinutes(time: string) {
  const [hours, minutes] = time.slice(0, 5).split(':').map(Number)
  return hours * 60 + minutes
}

function rangesOverlap(startA: string, durationA: number, startB: string, durationB: number) {
  const startAMinutes = timeToMinutes(startA)
  const endAMinutes = startAMinutes + durationA
  const startBMinutes = timeToMinutes(startB)
  const endBMinutes = startBMinutes + durationB

  return startAMinutes < endBMinutes && startBMinutes < endAMinutes
}

function durationLabel(minutes: number) {
  if (minutes === 60) return '1h'
  if (minutes === 90) return '1h30'
  if (minutes === 120) return '2h'
  if (minutes === 180) return '3h'
  return `${minutes} min`
}

export default function PlanningPage() {
  const supabase = useMemo(() => createClient(), [])
  const [currentWeekStart, setCurrentWeekStart] = useState<Date>(() => getWeekStart(new Date()))
  const [plannedSessions, setPlannedSessions] = useState<PlannedSession[]>([])
  const [templates, setTemplates] = useState<ScheduleTemplate[]>([])
  const [teachers, setTeachers] = useState<Teacher[]>([])
  const [rooms, setRooms] = useState<Room[]>([])
  const [view, setView] = useState<ViewMode>('week')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showTemplateForm, setShowTemplateForm] = useState(false)
  const [editingTemplate, setEditingTemplate] = useState<ScheduleTemplate | null>(null)
  const [overrideSession, setOverrideSession] = useState<PlannedSession | null>(null)
  const [processingSessionId, setProcessingSessionId] = useState<string | null>(null)

  const weekDates = useMemo(() => getWeekDates(currentWeekStart), [currentWeekStart])

  const fetchReferenceData = useCallback(async () => {
    const [teachersRes, roomsRes, templatesRes] = await Promise.all([
      supabase.from('teachers').select('*').eq('status', 'active').order('full_name'),
      supabase.from('rooms').select('*, center:centers(name)').order('name'),
      supabase
        .from('schedule_templates')
        .select('*, teacher:teachers(full_name, hourly_rate), room:rooms(name), campus:centers(name)')
        .eq('is_active', true)
        .order('day_of_week')
        .order('start_time'),
    ])

    if (teachersRes.error) throw new Error(teachersRes.error.message)
    if (roomsRes.error) throw new Error(roomsRes.error.message)
    if (templatesRes.error) throw new Error(templatesRes.error.message)

    setTeachers((teachersRes.data || []) as Teacher[])
    setRooms((roomsRes.data || []) as Room[])
    setTemplates((templatesRes.data || []) as ScheduleTemplate[])
  }, [supabase])

  const fetchWeekSessions = useCallback(async (weekStart: Date) => {
    const start = formatIsoDate(weekStart)
    const endDate = new Date(weekStart)
    endDate.setDate(weekStart.getDate() + 5)
    const end = formatIsoDate(endDate)

    const { data, error: sessionsError } = await supabase
      .from('planned_sessions')
      .select(`
        *,
        teacher:teachers(full_name),
        room:rooms(name),
        campus:centers(name),
        template:schedule_templates(day_of_week, subject),
        linked_session:attendance_sessions(started_at, ended_at, duration_minutes)
      `)
      .gte('scheduled_date', start)
      .lte('scheduled_date', end)
      .order('scheduled_date')
      .order('start_time')

    if (sessionsError) throw new Error(sessionsError.message)

    const normalized = (data || []).map((session) => ({
      ...session,
      linked_session: session.linked_session
        ? {
            start_time: (session.linked_session as { started_at?: string }).started_at || null,
            end_time: (session.linked_session as { ended_at?: string }).ended_at || null,
            duration_minutes: (session.linked_session as { duration_minutes?: number | null }).duration_minutes || null,
          }
        : null,
    })) as PlannedSession[]

    setPlannedSessions(normalized)
  }, [supabase])

  useEffect(() => {
    let mounted = true

    async function load() {
      setLoading(true)
      setError('')
      try {
        await Promise.all([fetchReferenceData(), fetchWeekSessions(currentWeekStart)])
      } catch (loadError) {
        if (mounted) setError(loadError instanceof Error ? loadError.message : 'Erreur de chargement.')
      } finally {
        if (mounted) setLoading(false)
      }
    }

    void load()

    return () => {
      mounted = false
    }
  }, [currentWeekStart, fetchReferenceData, fetchWeekSessions])

  const getTeacherName = useCallback((teacherId: string) => {
    return teachers.find((teacher) => teacher.id === teacherId)?.full_name || 'ce professeur'
  }, [teachers])

  const getRoomName = useCallback((roomId: string | null) => {
    if (!roomId) return 'cette salle'
    return rooms.find((room) => room.id === roomId)?.name || 'cette salle'
  }, [rooms])

  const getTemplateConflictError = useCallback((payload: TemplatePayload) => {
    const conflictingTemplate = templates.find((template) => {
      if (!template.is_active) return false
      if (editingTemplate && template.id === editingTemplate.id) return false
      if (template.day_of_week !== payload.day_of_week) return false
      if (!rangesOverlap(template.start_time, template.duration_minutes, payload.start_time, payload.duration_minutes)) {
        return false
      }

      const sameTeacher = template.teacher_id === payload.teacher_id
      const sameRoom = Boolean(template.room_id && payload.room_id && template.room_id === payload.room_id)
      return sameTeacher || sameRoom
    })

    if (!conflictingTemplate) return null

    if (conflictingTemplate.teacher_id === payload.teacher_id) {
      return `Conflit de planning : ${getTeacherName(payload.teacher_id)} a déjà un créneau ${DAY_LABELS[conflictingTemplate.day_of_week]} à ${conflictingTemplate.start_time.slice(0, 5)}.`
    }

    return `Conflit de salle : ${getRoomName(payload.room_id)} est déjà occupée ${DAY_LABELS[conflictingTemplate.day_of_week]} à ${conflictingTemplate.start_time.slice(0, 5)}.`
  }, [editingTemplate, getRoomName, getTeacherName, templates])

  const getPlannedSessionConflictError = useCallback((session: PlannedSession) => {
    const conflictingSession = plannedSessions.find((candidate) => {
      if (candidate.id === session.id) return false
      if (candidate.scheduled_date !== session.scheduled_date) return false
      if (candidate.status === 'cancelled') return false
      if (!rangesOverlap(candidate.start_time, candidate.duration_minutes, session.start_time, session.duration_minutes)) {
        return false
      }

      const sameTeacher = candidate.teacher_id === session.teacher_id
      const sameRoom = Boolean(candidate.room_id && session.room_id && candidate.room_id === session.room_id)
      return sameTeacher || sameRoom
    })

    if (!conflictingSession) return null

    if (conflictingSession.teacher_id === session.teacher_id) {
      return `Conflit de planning : ${getTeacherName(session.teacher_id)} a déjà un créneau le ${session.scheduled_date} à ${conflictingSession.start_time.slice(0, 5)}.`
    }

    return `Conflit de salle : ${getRoomName(session.room_id)} est déjà occupée le ${session.scheduled_date} à ${conflictingSession.start_time.slice(0, 5)}.`
  }, [getRoomName, getTeacherName, plannedSessions])

  const handleGenerateWeek = async () => {
    setLoading(true)
    const result = await generateWeekSessions(currentWeekStart)
    if (result.error) {
      setError(result.error)
      setLoading(false)
      return
    }
    await fetchWeekSessions(currentWeekStart)
    setLoading(false)
  }

  const handleTemplateSave = async ({ templates: payloads }: TemplateSavePayload) => {
    setError('')
    for (const payload of payloads) {
      const conflictError = getTemplateConflictError(payload)
      if (conflictError) {
        setError(conflictError)
        return
      }
    }

    if (editingTemplate) {
      const payload = payloads[0]
      if (!payload) return
      const { error: updateError } = await supabase
        .from('schedule_templates')
        .update(payload)
        .eq('id', editingTemplate.id)
      if (updateError) {
        setError(updateError.message)
        return
      }
    } else {
      const { data: authData } = await supabase.auth.getUser()
      const { error: insertError } = await supabase.from('schedule_templates').insert(
        payloads.map((payload) => ({
          ...payload,
          created_by: authData.user?.id || null,
        }))
      )
      if (insertError) {
        setError(insertError.message)
        return
      }
    }

    setShowTemplateForm(false)
    setEditingTemplate(null)
    await fetchReferenceData()
    await fetchWeekSessions(currentWeekStart)
  }

  const handleDeleteTemplate = async (id: string) => {
    const { error: updateError } = await supabase
      .from('schedule_templates')
      .update({ is_active: false })
      .eq('id', id)

    if (updateError) {
      setError(updateError.message)
      return
    }

    await fetchReferenceData()
  }

  const handleDeleteTemplatePermanently = async (template: ScheduleTemplate) => {
    const confirmed = window.prompt(
      `Tapez SUPPRIMER pour retirer définitivement le template "${template.group_label || template.subject || template.teacher?.full_name || 'créneau'}".`
    )

    if (confirmed !== 'SUPPRIMER') {
      return
    }

    setError('')

    const { error: deleteSessionsError } = await supabase
      .from('planned_sessions')
      .delete()
      .eq('template_id', template.id)
      .in('status', ['scheduled', 'cancelled', 'absent'])

    if (deleteSessionsError) {
      setError(deleteSessionsError.message)
      return
    }

    const { error: deleteTemplateError } = await supabase
      .from('schedule_templates')
      .delete()
      .eq('id', template.id)

    if (deleteTemplateError) {
      setError(deleteTemplateError.message)
      return
    }

    await fetchReferenceData()
    await fetchWeekSessions(currentWeekStart)
  }

  const handleOverrideSave = async (updates: Partial<PlannedSession>) => {
    if (!overrideSession) return
    const mergedSession: PlannedSession = {
      ...overrideSession,
      ...updates,
    }

    if (mergedSession.status !== 'cancelled') {
      const conflictError = getPlannedSessionConflictError(mergedSession)
      if (conflictError) {
        setError(conflictError)
        return
      }
    }

    const { error: updateError } = await supabase
      .from('planned_sessions')
      .update(updates)
      .eq('id', overrideSession.id)

    if (updateError) {
      setError(updateError.message)
      return
    }

    setOverrideSession(null)
    await fetchWeekSessions(currentWeekStart)
  }

  const handleCancelSession = async (session: PlannedSession) => {
    const reason = window.prompt('Raison de l’annulation du créneau :', session.override_reason || 'Créneau annulé')
    if (!reason?.trim()) return

    const { error: updateError } = await supabase
      .from('planned_sessions')
      .update({
        status: 'cancelled',
        is_override: true,
        override_reason: reason.trim(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', session.id)

    if (updateError) {
      setError(updateError.message)
      return
    }

    await fetchWeekSessions(currentWeekStart)
  }

  const handleDeleteSession = async (session: PlannedSession) => {
    const confirmed = window.prompt(
      `Tapez SUPPRIMER pour retirer définitivement le créneau "${session.group_label || session.subject || session.teacher?.full_name || session.start_time}".`
    )

    if (confirmed !== 'SUPPRIMER') {
      return
    }

    const { error: deleteError } = await supabase
      .from('planned_sessions')
      .delete()
      .eq('id', session.id)

    if (deleteError) {
      setError(deleteError.message)
      return
    }

    await fetchWeekSessions(currentWeekStart)
  }

  const handleMarkSessionCompleted = async (session: PlannedSession) => {
    const reason = window.prompt(
      'Motif de la validation manuelle :',
      'Séance effectuée sans pointage QR',
    )

    if (!reason?.trim()) return

    setError('')
    setProcessingSessionId(session.id)

    const result = await manuallyCompletePlannedSession(session.id, reason.trim())

    setProcessingSessionId(null)

    if (result?.error) {
      setError(result.error)
      return
    }

    await fetchWeekSessions(currentWeekStart)
  }

  return (
    <div className="page-enter" style={{ padding: '1.5rem', maxWidth: 1400, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
        <div>
          <h1 style={{ fontSize: '1.65rem', fontWeight: 800, color: 'var(--brand-navy)', marginBottom: '0.35rem' }}>
            Planning
          </h1>
          <p style={{ color: 'var(--brand-muted)', fontSize: '0.92rem' }}>
            {formatWeekLabel(currentWeekStart)}
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <button className={`btn ${view === 'week' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setView('week')}>
            Vue semaine
          </button>
          <button className={`btn ${view === 'templates' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setView('templates')}>
            Gérer les templates
          </button>
        </div>
      </div>

      {error ? (
        <div className="brand-modal-error" style={{ marginBottom: '1rem' }}>
          {error}
        </div>
      ) : null}

      <div className="brand-card brand-card-pad" style={{ marginBottom: '1.25rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
            {view === 'week' ? (
              <>
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => setCurrentWeekStart((current) => {
                    const next = new Date(current)
                    next.setDate(current.getDate() - 7)
                    return next
                  })}
                >
                  ← Semaine préc.
                </button>
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => setCurrentWeekStart((current) => {
                    const next = new Date(current)
                    next.setDate(current.getDate() + 7)
                    return next
                  })}
                >
                  Semaine suiv. →
                </button>
                <span style={{ color: 'var(--brand-navy)', fontWeight: 700 }}>
                  {formatCompactWeekRange(currentWeekStart)}
                </span>
              </>
            ) : (
              <span style={{ color: 'var(--brand-navy)', fontWeight: 700 }}>
                {templates.length} template(s) actif(s)
              </span>
            )}
          </div>

          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            {view === 'week' ? (
              <button className="btn btn-primary" onClick={handleGenerateWeek} disabled={loading}>
                Générer la semaine
              </button>
            ) : null}
            <button
              className="btn btn-secondary"
              onClick={() => {
                setEditingTemplate(null)
                setShowTemplateForm(true)
              }}
            >
              + Nouveau template
            </button>
          </div>
        </div>
      </div>

      {view === 'week' ? (
        <WeekView
          sessions={plannedSessions}
          weekDates={weekDates}
          onOverride={(session) => setOverrideSession(session)}
          onCancel={handleCancelSession}
          onDelete={handleDeleteSession}
          onMarkCompleted={handleMarkSessionCompleted}
          loading={loading}
          processingSessionId={processingSessionId}
        />
      ) : (
        <section className="brand-card">
          <div className="brand-panel-header">
            <span className="brand-panel-title">Templates actifs</span>
            <span className="brand-panel-action">{templates.length} créneau(x)</span>
          </div>
          {loading ? (
            <div className="brand-empty">Chargement...</div>
          ) : templates.length === 0 ? (
            <div className="brand-empty">Aucun template actif.</div>
          ) : (
            <div className="brand-staff-table-wrap">
                <table className="brand-staff-table">
                  <thead>
                    <tr>
                      <th>Professeur</th>
                      <th>Groupe</th>
                      <th>Jour</th>
                      <th>Heure</th>
                      <th>Durée</th>
                      <th>Salle</th>
                      <th>Type</th>
                      <th>Public</th>
                      <th>Matière</th>
                      <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {templates.map((template) => (
                    <tr key={template.id}>
                      <td className="brand-staff-strong">{template.teacher?.full_name || '—'}</td>
                      <td>{template.group_label || template.subject || '—'}</td>
                      <td>{['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'][template.day_of_week]}</td>
                      <td>{template.start_time.slice(0, 5)}</td>
                      <td>{durationLabel(template.duration_minutes)}</td>
                      <td>{template.room?.name || '—'}</td>
                      <td>{template.session_type === 'one_to_one' ? 'One-to-one' : 'Groupe'}</td>
                      <td>{template.audience ? ({ kids: 'Kids', teens: 'Teens', adults: 'Adults' }[template.audience]) : '—'}</td>
                      <td>{template.subject || '—'}</td>
                      <td>
                        <div className="brand-staff-actions">
                          <button
                            className="brand-staff-icon-btn"
                            onClick={() => {
                              setEditingTemplate(template)
                              setShowTemplateForm(true)
                            }}
                          >
                            Modifier
                          </button>
                          <button className="brand-staff-icon-btn danger" onClick={() => handleDeleteTemplate(template.id)}>
                            Désactiver
                          </button>
                          <button
                            className="brand-staff-icon-btn danger"
                            style={{ borderColor: '#fecaca', color: '#b91c1c' }}
                            onClick={() => handleDeleteTemplatePermanently(template)}
                          >
                            Supprimer
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {showTemplateForm ? (
        <TemplateForm
          template={editingTemplate}
          teachers={teachers}
          rooms={rooms}
          onSave={handleTemplateSave}
          onClose={() => {
            setShowTemplateForm(false)
            setEditingTemplate(null)
          }}
        />
      ) : null}

      {overrideSession ? (
        <SessionOverrideModal
          session={overrideSession}
          teachers={teachers}
          rooms={rooms}
          onSave={handleOverrideSave}
          onClose={() => setOverrideSession(null)}
        />
      ) : null}
    </div>
  )
}
