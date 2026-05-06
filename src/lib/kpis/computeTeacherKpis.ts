import type { AttendanceSession, Teacher } from '@/lib/types'
import type { PlannedSession } from '@/types/planning'
import type { NextSession, TeacherMonthKpis, WeekSummary } from '@/types/kpis'

const CASABLANCA_TIME_ZONE = 'Africa/Casablanca'

function round(value: number, digits = 1) {
  const factor = 10 ** digits
  return Math.round(value * factor) / factor
}

function roundPayableAmount(value: number) {
  const rounded = round(value, 2)
  const nearestWhole = Math.round(rounded)

  if (Math.abs(rounded - nearestWhole) <= 0.02) {
    return nearestWhole
  }

  return rounded
}

function toDateParts(date: Date) {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: CASABLANCA_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
  const parts = formatter.formatToParts(date)
  return {
    year: Number(parts.find((part) => part.type === 'year')?.value || '0'),
    month: Number(parts.find((part) => part.type === 'month')?.value || '0'),
    day: Number(parts.find((part) => part.type === 'day')?.value || '0'),
  }
}

function toDateKey(date: Date) {
  const parts = toDateParts(date)
  return `${parts.year}-${String(parts.month).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}`
}

function getPayableMinutes(session: AttendanceSession) {
  return session.planned_duration_minutes || session.duration_minutes || 0
}

function getTeacherRateForMinutes(teacher: Teacher, minutes: number) {
  if ([60, 120].includes(minutes)) {
    return teacher.hourly_rate_short || teacher.hourly_rate || 0
  }
  if ([90, 180].includes(minutes)) {
    return teacher.hourly_rate_long || teacher.hourly_rate || 0
  }
  return teacher.hourly_rate || 0
}

function getAttendancePay(session: AttendanceSession, teacherRate = 0) {
  if (typeof session.payable_amount === 'number' && session.payable_amount > 0) {
    return session.payable_amount
  }

  const minutes = getPayableMinutes(session)
  const hourlyRate = session.applied_hourly_rate || teacherRate
  return roundPayableAmount((minutes / 60) * hourlyRate)
}

function parseTimeToMinutes(time: string) {
  const [hours, minutes] = time.slice(0, 5).split(':').map(Number)
  return ((hours || 0) * 60) + (minutes || 0)
}

function getSessionStartDifferenceMinutes(session: PlannedSession) {
  if (!session.linked_session?.start_time) return null

  const plannedMinutes = parseTimeToMinutes(session.start_time)
  const actualDate = new Date(session.linked_session.start_time)
  if (Number.isNaN(actualDate.getTime())) return null

  const actualParts = new Intl.DateTimeFormat('fr-FR', {
    timeZone: CASABLANCA_TIME_ZONE,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(actualDate)
  const actualHours = Number(actualParts.find((part) => part.type === 'hour')?.value || '0')
  const actualMinutes = Number(actualParts.find((part) => part.type === 'minute')?.value || '0')
  return ((actualHours * 60) + actualMinutes) - plannedMinutes
}

function formatSessionLabel(dateKey: string) {
  const [year, month, day] = dateKey.split('-').map(Number)
  return new Date(year, (month || 1) - 1, day || 1).toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })
}

function buildWeekSummaries(plannedSessions: PlannedSession[]): WeekSummary[] {
  const weekMap = new Map<number, WeekSummary>()

  plannedSessions.forEach((session) => {
    const day = Number(session.scheduled_date.split('-')[2] || '1')
    const weekIndex = Math.floor((day - 1) / 7) + 1
    const existing = weekMap.get(weekIndex) || {
      weekLabel: `Sem. ${weekIndex}`,
      completed: 0,
      absent: 0,
      hours: 0,
    }

    if (session.status === 'completed') {
      existing.completed += 1
      existing.hours += session.duration_minutes / 60
    }

    if (session.status === 'absent') {
      existing.absent += 1
    }

    weekMap.set(weekIndex, existing)
  })

  return Array.from(weekMap.entries())
    .sort((left, right) => left[0] - right[0])
    .map(([, value]) => ({ ...value, hours: round(value.hours, 1) }))
}

export function computeTeacherMonthKpis(
  plannedSessions: PlannedSession[],
  attendanceSessions: AttendanceSession[],
  teacher: Teacher,
  month: number,
  year: number,
): TeacherMonthKpis {
  const currentMonthPlanned = plannedSessions.filter((session) => {
    const [sessionYear, sessionMonth] = session.scheduled_date.split('-').map(Number)
    return sessionYear === year && sessionMonth === month + 1
  })
  const currentMonthAttendance = attendanceSessions.filter((session) => {
    const parts = toDateParts(new Date(session.started_at))
    return parts.year === year && parts.month === month + 1
  })
  const effectivePlanned = currentMonthPlanned.filter((session) => session.status !== 'cancelled')
  const completedSessions = effectivePlanned.filter((session) => session.status === 'completed')
  const absentSessions = effectivePlanned.filter((session) => session.status === 'absent')
  const attendedSessions = effectivePlanned.filter((session) => ['completed', 'in_progress'].includes(session.status) && session.linked_session?.start_time)
  const lateCount = attendedSessions.filter((session) => {
    const difference = getSessionStartDifferenceMinutes(session)
    return difference !== null && difference > 15
  }).length
  const now = new Date()
  const nowKey = toDateKey(now)
  const nowTime = new Intl.DateTimeFormat('fr-FR', {
    timeZone: CASABLANCA_TIME_ZONE,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(now)

  const nextSessions: NextSession[] = effectivePlanned
    .filter((session) => {
      if (!['scheduled', 'in_progress'].includes(session.status)) return false
      return session.scheduled_date > nowKey || (session.scheduled_date === nowKey && session.start_time >= nowTime)
    })
    .sort((left, right) => {
      if (left.scheduled_date === right.scheduled_date) {
        return left.start_time.localeCompare(right.start_time)
      }
      return left.scheduled_date.localeCompare(right.scheduled_date)
    })
    .slice(0, 3)
    .map((session) => ({
      date: formatSessionLabel(session.scheduled_date),
      start_time: session.start_time.slice(0, 5),
      duration_minutes: session.duration_minutes,
      room_name: session.room?.name || 'Salle non assignée',
      session_type: session.session_type === 'one_to_one' ? 'One-to-one' : 'Groupe',
    }))

  return {
    plannedHours: round(effectivePlanned.reduce((sum, session) => sum + session.duration_minutes, 0) / 60, 1),
    completedHours: round(completedSessions.reduce((sum, session) => sum + session.duration_minutes, 0) / 60, 1),
    absentHours: round(absentSessions.reduce((sum, session) => sum + session.duration_minutes, 0) / 60, 1),
    estimatedPayMAD: round(
      currentMonthAttendance.reduce(
        (sum, session) => sum + getAttendancePay(session, getTeacherRateForMinutes(teacher, getPayableMinutes(session))),
        0,
      ),
      2,
    ),
    sessionsCount: effectivePlanned.length,
    oneToOneCount: effectivePlanned.filter((session) => session.session_type === 'one_to_one').length,
    absenceCount: absentSessions.length,
    lateCount,
    punctualityRate: attendedSessions.length ? round(((attendedSessions.length - lateCount) / attendedSessions.length) * 100) : 0,
    completionRate: effectivePlanned.length ? round((completedSessions.length / effectivePlanned.length) * 100) : 0,
    nextSessions,
    byWeek: buildWeekSummaries(effectivePlanned),
  }
}
