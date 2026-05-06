'use client'

import type { CSSProperties } from 'react'
import { useEffect, useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronLeft, ChevronRight, FileText } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { getMyTeacherReportData } from '@/lib/actions'
import type { AttendanceSession, Teacher } from '@/lib/types'
import { computeTeacherMonthKpis } from '@/lib/kpis/computeTeacherKpis'
import { formatIsoDate } from '@/lib/planning/dateUtils'
import type { PlannedSession } from '@/types/planning'
import { KpiCard } from '../components/kpis/KpiCard'

const MONTH_NAMES = [
  'janvier',
  'février',
  'mars',
  'avril',
  'mai',
  'juin',
  'juillet',
  'août',
  'septembre',
  'octobre',
  'novembre',
  'décembre',
]

function monthRange(year: number, month: number) {
  const start = new Date(year, month, 1)
  const end = new Date(year, month + 1, 1)
  return { start, end }
}

function monthRangeUtc(year: number, month: number) {
  const startKey = formatIsoDate(new Date(year, month, 1))
  const endKey = formatIsoDate(new Date(year, month + 1, 1))
  return {
    startIso: new Date(`${startKey}T00:00:00+01:00`).toISOString(),
    endIso: new Date(`${endKey}T00:00:00+01:00`).toISOString(),
  }
}

function mapPlannedSessions(rows: Record<string, unknown>[]): PlannedSession[] {
  return rows.map((row) => {
    const linked = row.linked_session as { started_at?: string; ended_at?: string; duration_minutes?: number | null } | null
    return {
      ...(row as unknown as PlannedSession),
      linked_session: linked
        ? {
            start_time: linked.started_at || null,
            end_time: linked.ended_at || null,
            duration_minutes: linked.duration_minutes || null,
          }
        : null,
    }
  })
}

export default function TeacherMonthReportPage() {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])
  const now = useMemo(() => new Date(), [])
  const [authorized, setAuthorized] = useState<boolean | null>(null)
  const [teacher, setTeacher] = useState<Teacher | null>(null)
  const [plannedSessions, setPlannedSessions] = useState<PlannedSession[]>([])
  const [attendanceSessions, setAttendanceSessions] = useState<AttendanceSession[]>([])
  const [month, setMonth] = useState(now.getMonth())
  const [year, setYear] = useState(now.getFullYear())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    let cancelled = false

    const verifyAndLoad = async () => {
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

      if (profile?.role !== 'teacher') {
        router.replace('/dashboard')
        return
      }

      if (cancelled) return
      setAuthorized(true)

      const { data: teacherRow, error: teacherError } = await supabase
        .from('teachers')
        .select('id, user_id, full_name, email, phone, languages, hourly_rate, hourly_rate_short, hourly_rate_long, status, created_at')
        .eq('user_id', user.id)
        .single()

      if (teacherError || !teacherRow) {
        if (!cancelled) {
          setError(teacherError?.message || 'Profil professeur introuvable.')
          setLoading(false)
        }
        return
      }

      if (cancelled) return
      setTeacher(teacherRow as Teacher)
    }

    void verifyAndLoad()

    return () => {
      cancelled = true
    }
  }, [router, supabase])

  useEffect(() => {
    if (!authorized || !teacher) return

    let cancelled = false

    const fetchMonthData = async () => {
      setLoading(true)
      setError(null)
      const range = monthRange(year, month)
      const utcRange = monthRangeUtc(year, month)

      const [plannedResult, attendanceResult] = await Promise.all([
        supabase
          .from('planned_sessions')
          .select('*, room:rooms(name), linked_session:attendance_sessions(started_at, ended_at, duration_minutes)')
          .eq('teacher_id', teacher.id)
          .gte('scheduled_date', formatIsoDate(range.start))
          .lt('scheduled_date', formatIsoDate(range.end))
          .order('scheduled_date')
          .order('start_time'),
        supabase
          .from('attendance_sessions')
          .select('*, room:rooms(name)')
          .eq('teacher_id', teacher.id)
          .gte('started_at', utcRange.startIso)
          .lt('started_at', utcRange.endIso)
          .order('started_at'),
      ])

      if (cancelled) return

      if (plannedResult.error || attendanceResult.error) {
        setError(plannedResult.error?.message || attendanceResult.error?.message || 'Chargement impossible.')
        setLoading(false)
        return
      }

      setPlannedSessions(mapPlannedSessions((plannedResult.data || []) as Record<string, unknown>[]))
      setAttendanceSessions((attendanceResult.data || []) as AttendanceSession[])
      setLoading(false)
    }

    void fetchMonthData()

    return () => {
      cancelled = true
    }
  }, [authorized, month, supabase, teacher, year])

  const kpis = useMemo(
    () => (teacher ? computeTeacherMonthKpis(plannedSessions, attendanceSessions, teacher, month, year) : null),
    [attendanceSessions, month, plannedSessions, teacher, year],
  )

  const handleDownload = () => {
    if (!teacher) return
    const range = monthRange(year, month)

    startTransition(async () => {
      const result = await getMyTeacherReportData(formatIsoDate(range.start), formatIsoDate(new Date(range.end.getTime() - 1)))
      if (result.error || !result.data) {
        setError(result.error || 'Impossible de générer le PDF.')
        return
      }

      const { generateTeacherReportPdf } = await import('@/lib/pdf/generateTeacherReport')
      await generateTeacherReportPdf(result.data)
    })
  }

  if (authorized === null || loading) {
    return <PageState label="Chargement de votre rapport..." />
  }

  if (!teacher || !kpis) {
    return <PageState label={error || 'Rapport indisponible.'} />
  }

  const firstName = teacher.full_name.split(' ')[0] || teacher.full_name
  const circumference = 2 * Math.PI * 54
  const progress = circumference - ((Math.min(kpis.punctualityRate, 100) / 100) * circumference)
  const punctualityColor = kpis.punctualityRate >= 90 ? '#0F9D58' : kpis.punctualityRate >= 70 ? '#D97706' : '#E53E3E'

  return (
    <div style={{ minHeight: '100vh', background: '#FAF8F3', padding: '2rem clamp(1rem, 2vw, 2rem)' }}>
      <div style={{ maxWidth: 1280, margin: '0 auto', display: 'grid', gap: '1.2rem' }}>
        <header
          style={{
            background: '#FFFFFF',
            border: '1px solid #E8E2D5',
            borderRadius: 28,
            padding: '1.4rem',
            display: 'flex',
            justifyContent: 'space-between',
            gap: '1rem',
            flexWrap: 'wrap',
            alignItems: 'center',
          }}
        >
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
            <div
              style={{
                width: 58,
                height: 58,
                borderRadius: '50%',
                background: '#1B2D5B',
                color: '#FFFFFF',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 800,
                fontSize: '1.2rem',
              }}
            >
              {teacher.full_name.split(' ').map((chunk) => chunk[0]).slice(0, 2).join('').toUpperCase()}
            </div>
            <div>
              <div style={{ color: '#8B7D6B', fontSize: '0.86rem', fontWeight: 700 }}>Bonjour, {firstName}</div>
              <h1 style={{ margin: '0.2rem 0 0', color: '#1B2D5B', fontSize: '1.9rem', fontWeight: 800 }}>Mon rapport</h1>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.7rem' }}>
            <button
              type="button"
              style={secondaryButtonStyle}
              onClick={() => {
                if (month === 0) {
                  setMonth(11)
                  setYear((value) => value - 1)
                } else {
                  setMonth((value) => value - 1)
                }
              }}
            >
              <ChevronLeft size={16} />
            </button>
            <div style={{ minWidth: 170, textAlign: 'center', color: '#1B2D5B', fontWeight: 800 }}>
              {MONTH_NAMES[month]} {year}
            </div>
            <button
              type="button"
              style={secondaryButtonStyle}
              onClick={() => {
                if (month === 11) {
                  setMonth(0)
                  setYear((value) => value + 1)
                } else {
                  setMonth((value) => value + 1)
                }
              }}
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </header>

        {error ? (
          <div style={{ background: '#FEF2F2', border: '1px solid #F5C2C7', color: '#9B1C1C', padding: '0.9rem 1rem', borderRadius: 18 }}>
            {error}
          </div>
        ) : null}

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: '1rem',
          }}
        >
          <KpiCard label="Heures planifiées" value={kpis.plannedHours} unit="heures" />
          <KpiCard label="Heures complétées" value={kpis.completedHours} unit="heures" />
          <KpiCard label="Estimation" value={kpis.estimatedPayMAD.toLocaleString('fr-FR')} unit="MAD" />
          <KpiCard label="Taux de présence" value={kpis.completionRate} unit="%" />
        </div>

        <section style={cardStyle}>
          <div style={sectionTitleStyle}>Mes prochaines séances</div>
          {kpis.nextSessions.length === 0 ? (
            <EmptyState label="Aucune prochaine séance planifiée pour le moment." />
          ) : (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
                gap: '0.9rem',
              }}
            >
              {kpis.nextSessions.map((session) => (
                <article key={`${session.date}-${session.start_time}`} style={{ ...cardStyle, background: '#FAF8F3', padding: '1rem' }}>
                  <div style={{ color: '#1B2D5B', fontWeight: 800 }}>{session.date}</div>
                  <div style={{ marginTop: '0.35rem', color: '#6E6254', fontWeight: 600 }}>
                    {session.start_time} — {session.room_name}
                  </div>
                  <div style={{ marginTop: '0.35rem', color: '#8B7D6B' }}>
                    {session.duration_minutes === 60 ? '1h' : session.duration_minutes === 90 ? '1h30' : session.duration_minutes === 120 ? '2h' : session.duration_minutes === 180 ? '3h' : `${session.duration_minutes} min`} — {session.session_type}
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        <section style={cardStyle}>
          <div style={sectionTitleStyle}>Mon mois semaine par semaine</div>
          {kpis.byWeek.length === 0 ? (
            <EmptyState label="Aucune séance sur ce mois." />
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 520 }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #E8E2D5' }}>
                    {['Semaine', 'Séances', 'Heures', 'Absences'].map((label) => (
                      <th key={label} style={headerCellStyle}>{label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {kpis.byWeek.map((week) => (
                    <tr key={week.weekLabel} style={{ borderBottom: '1px solid #F1ECE3' }}>
                      <td style={tableCellStyle}>{week.weekLabel}</td>
                      <td style={tableCellStyle}>{week.completed}</td>
                      <td style={tableCellStyle}>{week.hours.toLocaleString('fr-FR')}h</td>
                      <td style={tableCellStyle}>{week.absent}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(260px, 340px) 1fr',
            gap: '1rem',
            alignItems: 'stretch',
          }}
        >
          <div style={{ ...cardStyle, display: 'grid', placeItems: 'center' }}>
            <div style={sectionTitleStyle}>Ma ponctualité</div>
            <svg width="180" height="180" viewBox="0 0 140 140" role="img" aria-label="Ponctualité">
              <circle cx="70" cy="70" r="54" fill="none" stroke="#E8E2D5" strokeWidth="12" />
              <circle
                cx="70"
                cy="70"
                r="54"
                fill="none"
                stroke={punctualityColor}
                strokeWidth="12"
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={progress}
                transform="rotate(-90 70 70)"
              />
              <text x="70" y="70" textAnchor="middle" dominantBaseline="central" fill="#1B2D5B" fontSize="24" fontWeight="800">
                {kpis.punctualityRate}%
              </text>
            </svg>
          </div>

          <div style={cardStyle}>
            <div style={sectionTitleStyle}>Synthèse</div>
            <div style={{ display: 'grid', gap: '0.7rem', color: '#3D4B6D', fontWeight: 600 }}>
              <div>{kpis.sessionsCount} séance(s) planifiée(s) sur la période.</div>
              <div>{kpis.oneToOneCount} séance(s) en one-to-one.</div>
              <div>{kpis.absenceCount} absence(s) enregistrée(s).</div>
              <div>{kpis.lateCount} arrivée(s) en retard.</div>
            </div>
          </div>
        </section>

        <div>
          <button
            type="button"
            onClick={handleDownload}
            disabled={isPending}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.55rem',
              border: '1px solid #C9A84C',
              background: '#1B2D5B',
              color: '#FFFFFF',
              borderRadius: 16,
              padding: '0.95rem 1.15rem',
              cursor: 'pointer',
              fontWeight: 800,
            }}
          >
            <FileText size={18} />
            {isPending ? 'Préparation du PDF...' : 'Télécharger mon rapport PDF'}
          </button>
        </div>
      </div>
    </div>
  )
}

function PageState({ label }: { label: string }) {
  return (
    <div style={{ minHeight: '100vh', background: '#FAF8F3', display: 'grid', placeItems: 'center', color: '#8B7D6B' }}>
      {label}
    </div>
  )
}

function EmptyState({ label }: { label: string }) {
  return <div style={{ color: '#8B7D6B', fontSize: '0.94rem' }}>{label}</div>
}

const cardStyle: CSSProperties = {
  background: '#FFFFFF',
  border: '1px solid #E8E2D5',
  borderRadius: 24,
  padding: '1.15rem',
}

const sectionTitleStyle: CSSProperties = {
  color: '#1B2D5B',
  fontWeight: 800,
  marginBottom: '1rem',
}

const headerCellStyle: CSSProperties = {
  padding: '0.9rem 0.75rem',
  textAlign: 'left',
  color: '#8B7D6B',
  fontSize: '0.78rem',
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
  fontWeight: 800,
}

const tableCellStyle: CSSProperties = {
  padding: '0.9rem 0.75rem',
  color: '#1B2D5B',
  fontWeight: 600,
}

const secondaryButtonStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  border: '1px solid #E8E2D5',
  background: '#FFFFFF',
  color: '#1B2D5B',
  borderRadius: 14,
  width: 40,
  height: 40,
  cursor: 'pointer',
}
