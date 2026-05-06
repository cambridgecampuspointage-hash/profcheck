'use client'

import type { CSSProperties } from 'react'
import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronLeft, ChevronRight, RefreshCcw } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { AttendanceSession, Room, Teacher } from '@/lib/types'
import { computeTodayKpis } from '@/lib/kpis/computeAdminKpis'
import { formatIsoDate, getWeekStart } from '@/lib/planning/generateWeekSessions'
import type { PlannedSession } from '@/types/planning'
import { AlertsBanner } from './components/kpis/AlertsBanner'
import { MonthPanel } from './components/kpis/MonthPanel'
import { TodayPanel } from './components/kpis/TodayPanel'
import { WeekPanel } from './components/kpis/WeekPanel'

type DashboardView = 'today' | 'week' | 'month'

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

function getCasablancaDateKey(date: Date) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Casablanca',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date)

  const year = parts.find((part) => part.type === 'year')?.value || '0000'
  const month = parts.find((part) => part.type === 'month')?.value || '01'
  const day = parts.find((part) => part.type === 'day')?.value || '01'
  return `${year}-${month}-${day}`
}

function monthRange(year: number, month: number) {
  const start = new Date(year, month, 1)
  const end = new Date(year, month + 1, 1)
  return { start, end }
}

function toFixedOffsetIso(dateKey: string, hour = 0) {
  return new Date(`${dateKey}T${String(hour).padStart(2, '0')}:00:00+01:00`).toISOString()
}

function dayRangeUtc(dateKey: string) {
  const [year, month, day] = dateKey.split('-').map(Number)
  const next = new Date(year, (month || 1) - 1, (day || 1) + 1)
  return {
    startIso: toFixedOffsetIso(dateKey),
    endIso: toFixedOffsetIso(formatIsoDate(next)),
  }
}

function monthRangeUtc(year: number, month: number) {
  const startKey = formatIsoDate(new Date(year, month, 1))
  const endKey = formatIsoDate(new Date(year, month + 1, 1))
  return {
    startIso: toFixedOffsetIso(startKey),
    endIso: toFixedOffsetIso(endKey),
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

export default function DashboardPage() {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])
  const now = useMemo(() => new Date(), [])
  const [authorized, setAuthorized] = useState<boolean | null>(null)
  const [activeView, setActiveView] = useState<DashboardView>('today')
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth())
  const [selectedYear, setSelectedYear] = useState(now.getFullYear())
  const [plannedSessions, setPlannedSessions] = useState<PlannedSession[]>([])
  const [attendanceSessions, setAttendanceSessions] = useState<AttendanceSession[]>([])
  const [previousPlannedSessions, setPreviousPlannedSessions] = useState<PlannedSession[]>([])
  const [previousAttendanceSessions, setPreviousAttendanceSessions] = useState<AttendanceSession[]>([])
  const [teachers, setTeachers] = useState<Teacher[]>([])
  const [rooms, setRooms] = useState<Room[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null)
  const [refreshNonce, setRefreshNonce] = useState(0)
  const [currentTimestamp, setCurrentTimestamp] = useState(() => Date.now())

  const weekStart = useMemo(() => getWeekStart(new Date()), [])

  useEffect(() => {
    let cancelled = false

    const verifyRole = async () => {
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

      if (cancelled) return

      if (profile?.role !== 'admin') {
        router.replace('/teacher/dashboard')
        return
      }

      setAuthorized(true)
    }

    void verifyRole()

    return () => {
      cancelled = true
    }
  }, [router, supabase])

  useEffect(() => {
    if (!authorized) return

    let cancelled = false

    const fetchData = async () => {
      setLoading(true)
      setError(null)

      try {
        if (activeView === 'today') {
          const todayKey = getCasablancaDateKey(new Date())
          const todayRange = dayRangeUtc(todayKey)

          const [plannedResult, attendanceResult] = await Promise.all([
            supabase
              .from('planned_sessions')
              .select('*, teacher:teachers(full_name), room:rooms(name), linked_session:attendance_sessions(started_at, ended_at, duration_minutes)')
              .eq('scheduled_date', todayKey)
              .order('start_time'),
            supabase
              .from('attendance_sessions')
              .select('*, teacher:teachers(full_name), room:rooms(name)')
              .gte('created_at', todayRange.startIso)
              .lt('created_at', todayRange.endIso)
              .order('started_at'),
          ])

          if (plannedResult.error) throw plannedResult.error
          if (attendanceResult.error) throw attendanceResult.error

          if (!cancelled) {
            setPlannedSessions(mapPlannedSessions((plannedResult.data || []) as Record<string, unknown>[]))
            setAttendanceSessions((attendanceResult.data || []) as AttendanceSession[])
            setTeachers([])
            setRooms([])
            setPreviousPlannedSessions([])
            setPreviousAttendanceSessions([])
            setLastRefresh(new Date())
            setCurrentTimestamp(Date.now())
          }
          return
        }

        if (activeView === 'week') {
          const weekEnd = new Date(weekStart)
          weekEnd.setDate(weekStart.getDate() + 5)

          const { data, error: plannedError } = await supabase
            .from('planned_sessions')
            .select('*, teacher:teachers(full_name), room:rooms(name), linked_session:attendance_sessions(started_at, ended_at, duration_minutes)')
            .gte('scheduled_date', formatIsoDate(weekStart))
            .lte('scheduled_date', formatIsoDate(weekEnd))
            .order('scheduled_date')
            .order('start_time')

          if (plannedError) throw plannedError

          if (!cancelled) {
            setPlannedSessions(mapPlannedSessions((data || []) as Record<string, unknown>[]))
            setAttendanceSessions([])
            setTeachers([])
            setRooms([])
            setPreviousPlannedSessions([])
            setPreviousAttendanceSessions([])
            setLastRefresh(new Date())
            setCurrentTimestamp(Date.now())
          }
          return
        }

        const currentRange = monthRange(selectedYear, selectedMonth)
        const currentUtcRange = monthRangeUtc(selectedYear, selectedMonth)
        const previousMonth = selectedMonth === 0 ? 11 : selectedMonth - 1
        const previousYear = selectedMonth === 0 ? selectedYear - 1 : selectedYear
        const previousRange = monthRange(previousYear, previousMonth)
        const previousUtcRange = monthRangeUtc(previousYear, previousMonth)

        const [plannedResult, attendanceResult, teacherResult, roomResult, previousPlannedResult, previousAttendanceResult] = await Promise.all([
          supabase
            .from('planned_sessions')
            .select('*, teacher:teachers(full_name), room:rooms(name), linked_session:attendance_sessions(started_at, ended_at, duration_minutes)')
            .gte('scheduled_date', formatIsoDate(currentRange.start))
            .lt('scheduled_date', formatIsoDate(currentRange.end))
            .order('scheduled_date')
            .order('start_time'),
          supabase
            .from('attendance_sessions')
            .select('*, teacher:teachers(full_name), room:rooms(name)')
            .gte('started_at', currentUtcRange.startIso)
            .lt('started_at', currentUtcRange.endIso)
            .order('started_at'),
          supabase
            .from('teachers')
            .select('id, user_id, full_name, email, phone, languages, hourly_rate, hourly_rate_short, hourly_rate_long, status, created_at')
            .eq('status', 'active')
            .order('full_name'),
          supabase
            .from('rooms')
            .select('id, center_id, name, description, status, created_at')
            .order('name'),
          supabase
            .from('planned_sessions')
            .select('*, teacher:teachers(full_name), room:rooms(name), linked_session:attendance_sessions(started_at, ended_at, duration_minutes)')
            .gte('scheduled_date', formatIsoDate(previousRange.start))
            .lt('scheduled_date', formatIsoDate(previousRange.end))
            .order('scheduled_date')
            .order('start_time'),
          supabase
            .from('attendance_sessions')
            .select('*, teacher:teachers(full_name), room:rooms(name)')
            .gte('started_at', previousUtcRange.startIso)
            .lt('started_at', previousUtcRange.endIso)
            .order('started_at'),
        ])

        if (plannedResult.error) throw plannedResult.error
        if (attendanceResult.error) throw attendanceResult.error
        if (teacherResult.error) throw teacherResult.error
        if (roomResult.error) throw roomResult.error
        if (previousPlannedResult.error) throw previousPlannedResult.error
        if (previousAttendanceResult.error) throw previousAttendanceResult.error

        if (!cancelled) {
          setPlannedSessions(mapPlannedSessions((plannedResult.data || []) as Record<string, unknown>[]))
          setAttendanceSessions((attendanceResult.data || []) as AttendanceSession[])
          setTeachers((teacherResult.data || []) as Teacher[])
          setRooms((roomResult.data || []) as Room[])
          setPreviousPlannedSessions(mapPlannedSessions((previousPlannedResult.data || []) as Record<string, unknown>[]))
          setPreviousAttendanceSessions((previousAttendanceResult.data || []) as AttendanceSession[])
          setLastRefresh(new Date())
          setCurrentTimestamp(Date.now())
        }
      } catch (caught) {
        if (!cancelled) {
          const message = caught instanceof Error ? caught.message : 'Impossible de charger le tableau de bord.'
          setError(message)
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void fetchData()

    return () => {
      cancelled = true
    }
  }, [activeView, authorized, refreshNonce, selectedMonth, selectedYear, supabase, weekStart])

  useEffect(() => {
    if (!authorized || activeView !== 'today') return

    const timer = window.setInterval(() => {
      setCurrentTimestamp(Date.now())
      setRefreshNonce((value) => value + 1)
    }, 60000)

    return () => {
      window.clearInterval(timer)
    }
  }, [activeView, authorized])

  const refreshAgeLabel = useMemo(() => {
    if (!lastRefresh) return 'Chargement…'
    const minutes = Math.max(0, Math.floor((currentTimestamp - lastRefresh.getTime()) / 60000))
    return minutes === 0 ? 'Mis à jour à l’instant' : `Mis à jour il y a ${minutes} min`
  }, [currentTimestamp, lastRefresh])

  const todaySubtitle = useMemo(
    () => new Date().toLocaleDateString('fr-FR', {
      timeZone: 'Africa/Casablanca',
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }),
    [],
  )

  const todayKpis = useMemo(
    () => computeTodayKpis(plannedSessions, attendanceSessions),
    [attendanceSessions, plannedSessions],
  )

  if (authorized === null) {
    return <PageState label="Vérification de l’accès au tableau de bord..." />
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#FAF8F3',
        padding: '2rem clamp(1rem, 2vw, 2rem)',
      }}
    >
      <div style={{ maxWidth: 1400, margin: '0 auto', display: 'grid', gap: '1.2rem' }}>
        <header
          style={{
            background: '#FFFFFF',
            border: '1px solid #E8E2D5',
            borderRadius: 28,
            padding: '1.4rem',
            display: 'grid',
            gap: '1rem',
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              gap: '1rem',
              flexWrap: 'wrap',
            }}
          >
            <div>
              <h1 style={{ margin: 0, color: '#1B2D5B', fontSize: '2rem', fontWeight: 800 }}>Tableau de bord</h1>
              <p style={{ margin: '0.35rem 0 0', color: '#8B7D6B', fontSize: '0.98rem' }}>{todaySubtitle}</p>
            </div>

            <div style={{ display: 'flex', gap: '0.7rem', alignItems: 'center', flexWrap: 'wrap' }}>
              <Tabs activeView={activeView} onChange={setActiveView} />

              {activeView === 'today' ? (
                <button
                  type="button"
                  onClick={() => {
                    setLastRefresh(null)
                    setRefreshNonce((value) => value + 1)
                  }}
                  style={secondaryButtonStyle}
                >
                  <RefreshCcw size={16} />
                  Actualiser
                </button>
              ) : null}
            </div>
          </div>

          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: '1rem',
              flexWrap: 'wrap',
            }}
          >
            <div style={{ color: '#8B7D6B', fontSize: '0.9rem' }}>{refreshAgeLabel}</div>

            {activeView === 'month' ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.7rem' }}>
                <button
                  type="button"
                  style={secondaryButtonStyle}
                  onClick={() => {
                    if (selectedMonth === 0) {
                      setSelectedMonth(11)
                      setSelectedYear((value) => value - 1)
                    } else {
                      setSelectedMonth((value) => value - 1)
                    }
                  }}
                >
                  <ChevronLeft size={16} />
                </button>
                <div style={{ minWidth: 170, textAlign: 'center', color: '#1B2D5B', fontWeight: 800 }}>
                  {MONTH_NAMES[selectedMonth]} {selectedYear}
                </div>
                <button
                  type="button"
                  style={secondaryButtonStyle}
                  onClick={() => {
                    if (selectedMonth === 11) {
                      setSelectedMonth(0)
                      setSelectedYear((value) => value + 1)
                    } else {
                      setSelectedMonth((value) => value + 1)
                    }
                  }}
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            ) : null}
          </div>
        </header>

        {error ? <ErrorBanner message={error} /> : null}

        {loading ? (
          <PageState label="Chargement des indicateurs..." />
        ) : activeView === 'today' ? (
          <>
            <AlertsBanner
              lateTeachers={todayKpis.lateTeachers}
              sessionsOutOfPlanning={todayKpis.sessionsOutOfPlanning}
              sessionsAbsent={todayKpis.sessionsAbsent}
            />
            <TodayPanel plannedSessions={plannedSessions} attendanceSessions={attendanceSessions} />
          </>
        ) : null}

        {!loading && activeView === 'week' ? (
          <WeekPanel plannedSessions={plannedSessions} weekStart={weekStart} />
        ) : null}

        {!loading && activeView === 'month' ? (
          <MonthPanel
            plannedSessions={plannedSessions}
            attendanceSessions={attendanceSessions}
            previousPlannedSessions={previousPlannedSessions}
            previousAttendanceSessions={previousAttendanceSessions}
            teachers={teachers}
            rooms={rooms}
            month={selectedMonth}
            year={selectedYear}
          />
        ) : null}
      </div>
    </div>
  )
}

function Tabs({
  activeView,
  onChange,
}: {
  activeView: DashboardView
  onChange: (view: DashboardView) => void
}) {
  const items: Array<{ value: DashboardView; label: string }> = [
    { value: 'today', label: "Aujourd'hui" },
    { value: 'week', label: 'Cette semaine' },
    { value: 'month', label: 'Ce mois' },
  ]

  return (
    <div
      style={{
        display: 'flex',
        gap: '0.5rem',
        background: '#F5F1E8',
        padding: '0.35rem',
        borderRadius: 999,
      }}
    >
      {items.map((item) => {
        const active = item.value === activeView
        return (
          <button
            key={item.value}
            type="button"
            onClick={() => onChange(item.value)}
            style={{
              border: 'none',
              cursor: 'pointer',
              borderRadius: 999,
              padding: '0.7rem 1rem',
              fontWeight: 800,
              color: active ? '#FFFFFF' : '#1B2D5B',
              background: active ? '#1B2D5B' : 'transparent',
            }}
          >
            {item.label}
          </button>
        )
      })}
    </div>
  )
}

function PageState({ label }: { label: string }) {
  return (
    <div
      style={{
        minHeight: 240,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#8B7D6B',
        background: '#FFFFFF',
        border: '1px solid #E8E2D5',
        borderRadius: 24,
      }}
    >
      {label}
    </div>
  )
}

function ErrorBanner({ message }: { message: string }) {
  return (
    <div
      style={{
        background: '#FEF2F2',
        border: '1px solid #F5C2C7',
        color: '#9B1C1C',
        padding: '0.95rem 1rem',
        borderRadius: 18,
        fontWeight: 600,
      }}
    >
      {message}
    </div>
  )
}

const secondaryButtonStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '0.45rem',
  border: '1px solid #E8E2D5',
  background: '#FFFFFF',
  color: '#1B2D5B',
  borderRadius: 14,
  padding: '0.75rem 0.95rem',
  cursor: 'pointer',
  fontWeight: 700,
}
