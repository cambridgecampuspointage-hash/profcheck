'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { DayAttendanceCard } from './components/DayAttendanceCard'
import { MonthSummaryTable } from './components/MonthSummaryTable'
import { WorkScheduleForm } from './components/WorkScheduleForm'
import {
  computeDayAttendanceKpis,
  computeReceptionMonthSummary,
  findScheduleForDate,
  minutesToLabel,
} from '@/lib/reception/computeReceptionKpis'
import type {
  ReceptionProfile,
  StaffAttendance,
  StaffSchedule,
  WorkSchedulePayload,
} from '@/types/reception'

function monthBounds(base: Date) {
  const start = new Date(base.getFullYear(), base.getMonth(), 1)
  const end = new Date(base.getFullYear(), base.getMonth() + 1, 1)

  const toIsoDate = (value: Date) =>
    `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`

  return {
    start: toIsoDate(start),
    end: toIsoDate(end),
  }
}

function formatDateInput(value: Date) {
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`
}

function parseDateInput(value: string) {
  const [year, month, day] = value.split('-').map(Number)
  return new Date(year, (month || 1) - 1, day || 1)
}

function formatMonthLabel(base: Date) {
  return base.toLocaleDateString('fr-FR', {
    month: 'long',
    year: 'numeric',
  })
}

function formatWorkDays(days: number[]) {
  const labels = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam']
  return days.map((day) => labels[day] || '?').join(' • ')
}

export default function ReceptionAdminDashboardPage() {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])
  const [authorized, setAuthorized] = useState<boolean | null>(null)
  const [loading, setLoading] = useState(true)
  const [receptionUsers, setReceptionUsers] = useState<ReceptionProfile[]>([])
  const [schedules, setSchedules] = useState<StaffSchedule[]>([])
  const [attendances, setAttendances] = useState<StaffAttendance[]>([])
  const [selectedDate, setSelectedDate] = useState(formatDateInput(new Date()))
  const [monthAnchor, setMonthAnchor] = useState(new Date())
  const [scheduleModalOpen, setScheduleModalOpen] = useState(false)
  const [editingSchedule, setEditingSchedule] = useState<StaffSchedule | null>(null)
  const [saving, setSaving] = useState(false)
  const [dayFilter, setDayFilter] = useState<'all' | 'anomalies' | 'present' | 'missing' | 'absent'>('all')
  const [error, setError] = useState<string | null>(null)

  const loadData = useCallback(async (monthDate: Date) => {
    setLoading(true)
    setError(null)

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      router.replace('/login')
      return
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profile?.role !== 'admin') {
      router.replace('/dashboard')
      return
    }

    setAuthorized(true)

    const bounds = monthBounds(monthDate)
    const [usersResult, schedulesResult, attendanceResult] = await Promise.all([
      supabase
        .from('profiles')
        .select('id, full_name, email, role')
        .eq('role', 'reception')
        .order('full_name'),
      supabase
        .from('staff_schedules')
        .select('*, profile:profiles!staff_schedules_user_id_fkey(id, full_name, email, role)')
        .eq('role', 'reception')
        .order('created_at'),
      supabase
        .from('staff_attendance')
        .select('*, profile:profiles!staff_attendance_user_id_fkey(id, full_name, email, role)')
        .gte('date', bounds.start)
        .lt('date', bounds.end)
        .order('date', { ascending: false }),
    ])

    if (usersResult.error || schedulesResult.error || attendanceResult.error) {
      setError(usersResult.error?.message || schedulesResult.error?.message || attendanceResult.error?.message || 'Chargement impossible.')
      setLoading(false)
      return
    }

    setReceptionUsers((usersResult.data || []) as ReceptionProfile[])
    setSchedules((schedulesResult.data || []) as unknown as StaffSchedule[])
    setAttendances((attendanceResult.data || []) as unknown as StaffAttendance[])
    setLoading(false)
  }, [router, supabase])

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadData(monthAnchor)
    }, 0)

    return () => window.clearTimeout(timeoutId)
  }, [loadData, monthAnchor])

  const saveSchedule = async (payload: WorkSchedulePayload) => {
    setSaving(true)

    const upsertPayload = {
      id: payload.id,
      user_id: payload.user_id,
      role: 'reception',
      expected_start: payload.expected_start,
      expected_end: payload.expected_end,
      max_break_minutes: payload.max_break_minutes,
      work_days: payload.work_days,
    }

    const { error: saveError } = await supabase
      .from('staff_schedules')
      .upsert(upsertPayload)

    setSaving(false)

    if (saveError) {
      throw new Error(saveError.message)
    }

    setScheduleModalOpen(false)
    setEditingSchedule(null)
    await loadData(monthAnchor)
  }

  const deleteSchedule = async (schedule: StaffSchedule) => {
    const confirmed = window.confirm(
      `Supprimer le créneau de ${schedule.profile?.full_name || 'cette réceptionniste'} ?`,
    )

    if (!confirmed) return

    setSaving(true)
    setError(null)

    const { error: deleteError } = await supabase
      .from('staff_schedules')
      .delete()
      .eq('id', schedule.id)

    setSaving(false)

    if (deleteError) {
      setError(deleteError.message || 'Suppression impossible.')
      return
    }

    if (editingSchedule?.id === schedule.id) {
      setEditingSchedule(null)
      setScheduleModalOpen(false)
    }

    await loadData(monthAnchor)
  }

  const deleteAttendance = async (attendance: StaffAttendance, staffName: string) => {
    const confirmed = window.confirm(
      `Supprimer le pointage du jour pour ${staffName} ?`,
    )

    if (!confirmed) return

    setSaving(true)
    setError(null)

    const { error: deleteError } = await supabase
      .from('staff_attendance')
      .delete()
      .eq('id', attendance.id)

    setSaving(false)

    if (deleteError) {
      setError(deleteError.message || 'Suppression du pointage impossible.')
      return
    }

    await loadData(monthAnchor)
  }

  const selectedDateObject = parseDateInput(selectedDate)
  const monthSummary = computeReceptionMonthSummary(schedules, attendances)
  const dayCards = receptionUsers.map((user) => {
    const userSchedules = schedules.filter((entry) => entry.user_id === user.id)
    const userSchedule = findScheduleForDate(userSchedules, selectedDateObject)
    const attendance =
      attendances.find((entry) => entry.user_id === user.id && entry.date === selectedDate) || null
    const kpis = computeDayAttendanceKpis(userSchedule, attendance)

    return {
      user,
      schedule: userSchedule,
      attendance,
      kpis,
    }
  })
  const todayOverview = {
    activeUsers: receptionUsers.length,
    plannedUsers: dayCards.filter((entry) => entry.schedule).length,
    clockedUsers: dayCards.filter((entry) => entry.attendance?.clock_in).length,
    anomalyCount: dayCards.reduce((total, entry) => {
      const late = entry.attendance?.late_minutes || 0
      const early = entry.attendance?.early_leave_minutes || 0
      const breakOvertime = entry.attendance?.break_overtime_minutes || 0
      const missingClockOut = entry.attendance?.clock_in && !entry.attendance?.clock_out ? 1 : 0
      const absent = entry.attendance?.status === 'absent' ? 1 : 0
      return total + Number(late > 0) + Number(early > 0) + Number(breakOvertime > 0) + Number(Boolean(missingClockOut)) + absent
    }, 0),
  }
  const priorityAlerts = dayCards.flatMap((entry) => {
    const anomalies = entry.kpis.anomalies.map((anomaly) => ({
      id: `${entry.user.id}-${anomaly.type}`,
      userLabel: entry.user.full_name || entry.user.email || 'Réceptionniste',
      title: anomaly.title,
      message: anomaly.message,
      severity: anomaly.severity,
      action:
        anomaly.type === 'absence'
          ? 'Vérifier la justification ou ajouter une absence validée.'
          : anomaly.type === 'missing_clock_out'
            ? 'Corriger la sortie ou compléter le pointage.'
            : anomaly.type === 'long_break'
              ? 'Contrôler la durée réelle de pause.'
              : 'Vérifier l’explication et consigner la note RH.',
    }))

    if (!entry.schedule && !entry.attendance) {
      return [{
        id: `${entry.user.id}-unscheduled`,
        userLabel: entry.user.full_name || entry.user.email || 'Réceptionniste',
        title: 'Aucun horaire prévu',
        message: 'Cette réceptionniste apparaît sans planning ni pointage pour la date sélectionnée.',
        severity: 'warning' as const,
        action: 'Créer un horaire si elle devait être présente.',
      }]
    }

    return anomalies
  })

  const filteredDayCards = dayCards.filter((entry) => {
    if (dayFilter === 'all') return true
    if (dayFilter === 'anomalies') return entry.kpis.anomalies.length > 0
    if (dayFilter === 'present') return entry.kpis.clockedIn
    if (dayFilter === 'missing') return Boolean(entry.attendance?.clock_in && !entry.attendance?.clock_out)
    if (dayFilter === 'absent') return entry.attendance?.status === 'absent'
    return true
  })

  const monthTotals = monthSummary.reduce(
    (acc, row) => {
      acc.workedDays += row.workedDays
      acc.totalPresentMinutes += row.totalPresentMinutes
      acc.absenceCount += row.absenceCount
      acc.lateCount += row.lateCount
      acc.longBreakCount += row.longBreakCount
      acc.missingClockOutCount += row.missingClockOutCount
      return acc
    },
    {
      workedDays: 0,
      totalPresentMinutes: 0,
      absenceCount: 0,
      lateCount: 0,
      longBreakCount: 0,
      missingClockOutCount: 0,
    },
  )
  const bestPerformer = monthSummary.reduce((best, row) => {
    const score = row.lateCount + row.absenceCount + row.longBreakCount + row.earlyLeaveCount + row.missingClockOutCount
    if (!best) return { row, score }
    return score < best.score ? { row, score } : best
  }, null as null | { row: (typeof monthSummary)[number]; score: number })
  const riskPerformer = monthSummary.reduce((worst, row) => {
    const score = row.lateCount + (row.absenceCount * 2) + row.longBreakCount + row.earlyLeaveCount + row.missingClockOutCount
    if (!worst) return { row, score }
    return score > worst.score ? { row, score } : worst
  }, null as null | { row: (typeof monthSummary)[number]; score: number })
  const punctualityRate = monthTotals.workedDays > 0
    ? Math.max(0, Math.round(((monthTotals.workedDays - monthTotals.lateCount) / monthTotals.workedDays) * 100))
    : 100
  const presenceAverage = monthSummary.length > 0
    ? Math.round(monthTotals.totalPresentMinutes / Math.max(monthSummary.length, 1))
    : 0

  if (authorized === null || loading) {
    return <PageState label="Chargement du suivi réception..." />
  }

  return (
    <div style={pageStyle}>
      <div style={containerStyle}>
        <div>
          <Link href="/dashboard" style={backLinkStyle}>
            ← Retour à l’accueil admin
          </Link>
        </div>

        <header style={heroStyle}>
          <div>
            <div style={eyebrowStyle}>Administration RH</div>
            <h1 style={titleStyle}>Suivi réception</h1>
            <p style={subtitleStyle}>
              Horaires variables, pointage quotidien et anomalies RH sans impact paie.
            </p>
          </div>
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => {
                setEditingSchedule(null)
                setScheduleModalOpen(true)
              }}
              style={primaryButtonStyle}
            >
              + Nouvel horaire
            </button>
          </div>
        </header>

        {error ? <div style={errorStyle}>{error}</div> : null}

        <section style={overviewGridStyle}>
          <OverviewTile label="Réceptionnistes actives" value={String(todayOverview.activeUsers)} hint="profils suivis" />
          <OverviewTile label="Présences prévues" value={String(todayOverview.plannedUsers)} hint={`pour le ${selectedDate.split('-').reverse().join('/')}`} />
          <OverviewTile label="Pointages saisis" value={String(todayOverview.clockedUsers)} hint="arrivées enregistrées" />
          <OverviewTile label="Anomalies du jour" value={String(todayOverview.anomalyCount)} hint="retards, pauses, absences" tone={todayOverview.anomalyCount > 0 ? 'warning' : 'default'} />
        </section>

        <section style={cardStyle}>
          <div style={sectionHeaderStyle}>
            <div>
              <div style={sectionTitleStyle}>Alertes prioritaires</div>
              <div style={sectionHintStyle}>Ce qui demande une action admin immédiate sur la date sélectionnée</div>
            </div>
            <div style={alertCountStyle}>
              {priorityAlerts.length} alerte(s)
            </div>
          </div>

          {priorityAlerts.length === 0 ? (
            <div style={successStateStyle}>
              Aucune anomalie bloquante détectée. La journée est propre pour l’instant.
            </div>
          ) : (
            <div style={alertListStyle}>
              {priorityAlerts.map((alert) => (
                <div
                  key={alert.id}
                  style={{
                    ...alertCardStyle,
                    borderColor: alert.severity === 'critical' ? 'rgba(229,62,62,0.2)' : '#F2D08A',
                    background: alert.severity === 'critical' ? 'rgba(229,62,62,0.06)' : '#FFF9EF',
                  }}
                >
                  <div style={{ display: 'grid', gap: '0.25rem' }}>
                    <div style={{ color: '#1B2D5B', fontWeight: 800 }}>{alert.userLabel}</div>
                    <div style={{ color: alert.severity === 'critical' ? '#E53E3E' : '#8A5B10', fontWeight: 800 }}>
                      {alert.title}
                    </div>
                    <div style={{ color: '#6F6253' }}>{alert.message}</div>
                  </div>
                  <div style={alertActionStyle}>{alert.action}</div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section style={cardStyle}>
          <div style={sectionHeaderStyle}>
            <div>
              <div style={sectionTitleStyle}>Plannings de travail</div>
              <div style={sectionHintStyle}>{schedules.length} horaire(s) configuré(s)</div>
            </div>
          </div>

          {schedules.length === 0 ? (
            <div style={emptyStyle}>Aucun horaire réception configuré pour le moment.</div>
          ) : (
            <div style={scheduleListStyle}>
              {schedules.map((schedule) => (
                <div key={schedule.id} style={scheduleCardStyle}>
                  <div>
                    <div style={{ color: '#1B2D5B', fontWeight: 800, fontSize: '1.05rem' }}>
                      {schedule.profile?.full_name || schedule.profile?.email || 'Réceptionniste'}
                    </div>
                    <div style={{ display: 'flex', gap: '0.45rem', flexWrap: 'wrap', marginTop: '0.55rem' }}>
                      <span style={inlinePillStyle}>{schedule.work_days.length} jour(s) / semaine</span>
                      <span style={inlinePillStyle}>{schedule.max_break_minutes} min pause max</span>
                    </div>
                    <div style={{ color: '#8B7D6B', marginTop: '0.3rem' }}>
                      {schedule.expected_start.slice(0, 5)} → {schedule.expected_end.slice(0, 5)}
                    </div>
                    <div style={{ color: '#8B7D6B', marginTop: '0.3rem', fontSize: '0.88rem' }}>
                      {formatWorkDays(schedule.work_days)}
                    </div>
                    {schedule.profile?.email ? (
                      <div style={{ color: '#A08F7A', marginTop: '0.35rem', fontSize: '0.82rem' }}>
                        {schedule.profile.email}
                      </div>
                    ) : null}
                  </div>
                  <div style={{ display: 'flex', gap: '0.65rem', flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      onClick={() => {
                        setEditingSchedule(schedule)
                        setScheduleModalOpen(true)
                      }}
                      style={secondaryButtonStyle}
                    >
                      Modifier
                    </button>
                    <button
                      type="button"
                      onClick={() => void deleteSchedule(schedule)}
                      disabled={saving}
                      style={dangerButtonStyle}
                    >
                      Supprimer
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section style={cardStyle}>
          <div style={sectionHeaderStyle}>
            <div>
              <div style={sectionTitleStyle}>Pointage du jour</div>
              <div style={sectionHintStyle}>Vue détaillée par réceptionniste</div>
            </div>
            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => setMonthAnchor(new Date(monthAnchor.getFullYear(), monthAnchor.getMonth() - 1, 1))}
                style={secondaryButtonStyle}
              >
                ←
              </button>
              <div style={monthPillStyle}>{formatMonthLabel(monthAnchor)}</div>
              <button
                type="button"
                onClick={() => setMonthAnchor(new Date(monthAnchor.getFullYear(), monthAnchor.getMonth() + 1, 1))}
                style={secondaryButtonStyle}
              >
                →
              </button>
              <input
                type="date"
                value={selectedDate}
                onChange={(event) => setSelectedDate(event.target.value)}
                style={dateInputStyle}
              />
            </div>
          </div>

          <div style={filterBarStyle}>
            <FilterChip label="Tout voir" active={dayFilter === 'all'} onClick={() => setDayFilter('all')} />
            <FilterChip label="Anomalies" active={dayFilter === 'anomalies'} onClick={() => setDayFilter('anomalies')} />
            <FilterChip label="Présentes" active={dayFilter === 'present'} onClick={() => setDayFilter('present')} />
            <FilterChip label="Sortie manquante" active={dayFilter === 'missing'} onClick={() => setDayFilter('missing')} />
            <FilterChip label="Absences" active={dayFilter === 'absent'} onClick={() => setDayFilter('absent')} />
          </div>

          {filteredDayCards.length === 0 ? (
            <div style={emptyStyle}>Aucune réceptionniste active trouvée.</div>
          ) : (
            <div style={dayGridStyle}>
              {filteredDayCards.map((entry) => (
                <div key={entry.user.id} style={{ display: 'grid', gap: '0.65rem' }}>
                  <DayAttendanceCard
                    title={entry.user.full_name || entry.user.email || 'Réceptionniste'}
                    schedule={entry.schedule}
                    attendance={entry.attendance}
                  />
                  {entry.attendance ? (
                    <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                      <button
                        type="button"
                        onClick={() => void deleteAttendance(entry.attendance as StaffAttendance, entry.user.full_name || entry.user.email || 'cette réceptionniste')}
                        disabled={saving}
                        style={dangerButtonStyle}
                      >
                        Supprimer le pointage
                      </button>
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </section>

        <section style={cardStyle}>
          <div style={sectionHeaderStyle}>
            <div>
              <div style={sectionTitleStyle}>Résumé du mois</div>
              <div style={sectionHintStyle}>Retards, absences, pauses longues et temps présent</div>
            </div>
          </div>
          <div style={insightGridStyle}>
            <InsightTile
              label="Ponctualité"
              value={`${punctualityRate}%`}
              hint="jours pointés sans retard"
            />
            <InsightTile
              label="Présence moyenne"
              value={presenceAverage > 0 ? minutesToLabel(presenceAverage) : '0 min'}
              hint="moyenne par réceptionniste"
            />
            <InsightTile
              label="Référence du mois"
              value={bestPerformer?.row.full_name || '—'}
              hint="profil le plus régulier"
            />
            <InsightTile
              label="À surveiller"
              value={riskPerformer?.row.full_name || '—'}
              hint="profil avec le plus d’anomalies"
              tone="warning"
            />
          </div>
          <div style={monthSummaryHeadlineStyle}>
            <span>{monthTotals.workedDays} jour(s) pointé(s)</span>
            <span>{monthTotals.lateCount} retard(s)</span>
            <span>{monthTotals.absenceCount} absence(s)</span>
            <span>{monthTotals.longBreakCount} pause(s) longue(s)</span>
            <span>{monthTotals.missingClockOutCount} sortie(s) manquante(s)</span>
            <span>{monthTotals.totalPresentMinutes > 0 ? `${minutesToLabel(monthTotals.totalPresentMinutes)} de présence` : 'Aucune présence cumulée'}</span>
          </div>
          <MonthSummaryTable rows={monthSummary} />
        </section>
      </div>

      {scheduleModalOpen ? (
        <WorkScheduleForm
          receptionUsers={receptionUsers}
          schedule={editingSchedule}
          onSave={saveSchedule}
          onClose={() => {
            if (!saving) {
              setScheduleModalOpen(false)
              setEditingSchedule(null)
            }
          }}
        />
      ) : null}
    </div>
  )
}

function PageState({ label }: { label: string }) {
  return (
    <div style={pageStyle}>
      <div style={{ ...containerStyle, color: '#1B2D5B', fontWeight: 700 }}>{label}</div>
    </div>
  )
}

function OverviewTile({
  label,
  value,
  hint,
  tone = 'default',
}: {
  label: string
  value: string
  hint: string
  tone?: 'default' | 'warning'
}) {
  return (
    <div
      style={{
        ...cardStyle,
        padding: '1rem 1.1rem',
        background: tone === 'warning' ? '#FFF9EF' : '#FFFFFF',
        borderColor: tone === 'warning' ? '#F2D08A' : '#E8E2D5',
      }}
    >
      <div style={{ color: '#8B7D6B', fontSize: '0.82rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        {label}
      </div>
      <div style={{ color: '#1B2D5B', fontSize: '1.9rem', fontWeight: 900, marginTop: '0.45rem' }}>{value}</div>
      <div style={{ color: '#8B7D6B', marginTop: '0.3rem', fontSize: '0.9rem' }}>{hint}</div>
    </div>
  )
}

function FilterChip({
  label,
  active,
  onClick,
}: {
  label: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        border: active ? '1px solid #1B2D5B' : '1px solid #E8E2D5',
        background: active ? '#1B2D5B' : '#FFFFFF',
        color: active ? '#FFFFFF' : '#1B2D5B',
        borderRadius: 999,
        padding: '0.55rem 0.85rem',
        fontWeight: 800,
        cursor: 'pointer',
      }}
    >
      {label}
    </button>
  )
}

function InsightTile({
  label,
  value,
  hint,
  tone = 'default',
}: {
  label: string
  value: string
  hint: string
  tone?: 'default' | 'warning'
}) {
  return (
    <div
      style={{
        border: `1px solid ${tone === 'warning' ? '#F2D08A' : '#E8E2D5'}`,
        background: tone === 'warning' ? '#FFF9EF' : '#FCFBF8',
        borderRadius: 20,
        padding: '0.95rem 1rem',
      }}
    >
      <div style={{ color: '#8B7D6B', fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        {label}
      </div>
      <div style={{ color: '#1B2D5B', fontWeight: 900, fontSize: '1.1rem', marginTop: '0.4rem' }}>
        {value}
      </div>
      <div style={{ color: '#8B7D6B', marginTop: '0.3rem', fontSize: '0.88rem' }}>{hint}</div>
    </div>
  )
}

const pageStyle = {
  minHeight: '100vh',
  background: '#FAF8F3',
  padding: '2rem 1rem',
}

const containerStyle = {
  maxWidth: 1220,
  margin: '0 auto',
  display: 'grid',
  gap: '1rem',
}

const heroStyle = {
  background: 'linear-gradient(135deg, #1B2D5B 0%, #314B87 100%)',
  borderRadius: 30,
  color: '#FFFFFF',
  padding: '1.5rem',
  display: 'flex',
  justifyContent: 'space-between',
  gap: '1rem',
  flexWrap: 'wrap' as const,
  alignItems: 'center',
}

const backLinkStyle = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '0.35rem',
  color: '#1B2D5B',
  fontWeight: 800,
  textDecoration: 'none',
}

const eyebrowStyle = {
  color: '#C9A84C',
  fontSize: '0.8rem',
  textTransform: 'uppercase' as const,
  letterSpacing: '0.08em',
  fontWeight: 800,
}

const titleStyle = {
  margin: '0.35rem 0 0',
  fontSize: '2rem',
  fontWeight: 800,
}

const subtitleStyle = {
  margin: '0.45rem 0 0',
  color: 'rgba(255,255,255,0.82)',
}

const cardStyle = {
  background: '#FFFFFF',
  border: '1px solid #E8E2D5',
  borderRadius: 26,
  padding: '1.15rem',
}

const overviewGridStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
  gap: '1rem',
}

const sectionHeaderStyle = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: '1rem',
  alignItems: 'center',
  flexWrap: 'wrap' as const,
  marginBottom: '1rem',
}

const filterBarStyle = {
  display: 'flex',
  gap: '0.65rem',
  flexWrap: 'wrap' as const,
  marginBottom: '1rem',
}

const sectionTitleStyle = {
  color: '#1B2D5B',
  fontWeight: 800,
  fontSize: '1.05rem',
}

const sectionHintStyle = {
  color: '#8B7D6B',
  marginTop: '0.25rem',
}

const primaryButtonStyle = {
  border: '1px solid #C9A84C',
  background: '#FFFFFF',
  color: '#1B2D5B',
  borderRadius: 16,
  padding: '0.85rem 1rem',
  fontWeight: 800,
  cursor: 'pointer',
}

const secondaryButtonStyle = {
  border: '1px solid #E8E2D5',
  background: '#FAF8F3',
  color: '#1B2D5B',
  borderRadius: 14,
  padding: '0.7rem 0.95rem',
  fontWeight: 700,
  cursor: 'pointer',
}

const dangerButtonStyle = {
  border: '1px solid rgba(229,62,62,0.2)',
  background: 'rgba(229,62,62,0.08)',
  color: '#E53E3E',
  borderRadius: 14,
  padding: '0.7rem 0.95rem',
  fontWeight: 800,
  cursor: 'pointer',
}

const scheduleListStyle = {
  display: 'grid',
  gap: '0.8rem',
}

const scheduleCardStyle = {
  border: '1px solid #F0E9DD',
  background: '#FCFBF8',
  borderRadius: 20,
  padding: '0.95rem 1rem',
  display: 'flex',
  justifyContent: 'space-between',
  gap: '1rem',
  flexWrap: 'wrap' as const,
  alignItems: 'center',
}

const inlinePillStyle = {
  border: '1px solid #E8E2D5',
  background: '#FFFFFF',
  color: '#1B2D5B',
  borderRadius: 999,
  padding: '0.25rem 0.55rem',
  fontSize: '0.78rem',
  fontWeight: 700,
}

const dayGridStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
  gap: '1rem',
}

const emptyStyle = {
  color: '#8B7D6B',
  padding: '0.35rem 0',
}

const successStateStyle = {
  border: '1px solid rgba(15,110,86,0.18)',
  background: 'rgba(15,110,86,0.08)',
  color: '#0F6E56',
  borderRadius: 18,
  padding: '0.95rem 1rem',
  fontWeight: 700,
}

const errorStyle = {
  border: '1px solid rgba(229,62,62,0.18)',
  background: 'rgba(229,62,62,0.08)',
  color: '#E53E3E',
  borderRadius: 18,
  padding: '0.9rem 1rem',
  fontWeight: 700,
}

const monthSummaryHeadlineStyle = {
  display: 'flex',
  gap: '0.75rem',
  flexWrap: 'wrap' as const,
  marginBottom: '1rem',
  color: '#8B7D6B',
  fontWeight: 700,
  fontSize: '0.9rem',
}

const alertCountStyle = {
  border: '1px solid #E8E2D5',
  background: '#FCFBF8',
  color: '#1B2D5B',
  borderRadius: 999,
  padding: '0.55rem 0.8rem',
  fontWeight: 800,
}

const alertListStyle = {
  display: 'grid',
  gap: '0.8rem',
}

const alertCardStyle = {
  border: '1px solid #E8E2D5',
  borderRadius: 18,
  padding: '0.95rem 1rem',
  display: 'grid',
  gap: '0.7rem',
}

const alertActionStyle = {
  color: '#1B2D5B',
  fontWeight: 700,
  background: 'rgba(255,255,255,0.7)',
  borderRadius: 14,
  padding: '0.65rem 0.8rem',
}

const insightGridStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
  gap: '0.8rem',
  marginBottom: '1rem',
}

const monthPillStyle = {
  border: '1px solid #E8E2D5',
  background: '#FFFFFF',
  color: '#1B2D5B',
  borderRadius: 999,
  padding: '0.65rem 0.95rem',
  fontWeight: 800,
  textTransform: 'capitalize' as const,
}

const dateInputStyle = {
  border: '1px solid #E8E2D5',
  background: '#FFFFFF',
  color: '#1B2D5B',
  borderRadius: 14,
  padding: '0.7rem 0.85rem',
}
