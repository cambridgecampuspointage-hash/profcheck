import type { AttendanceSession, Room, Teacher } from '@/lib/types'
import type { PlannedSession } from '@/types/planning'
import type {
  DayKpi,
  LateTeacher,
  MonthComparison,
  MonthKpis,
  RoomKpi,
  TeacherMonthKpi,
  TeacherWeekKpi,
  TodayKpis,
  WeekKpis,
} from '@/types/kpis'

const CASABLANCA_TIME_ZONE = 'Africa/Casablanca'
const MAX_ROOM_SESSIONS_PER_DAY = 6

type MonthComparisonData = {
  plannedSessions: PlannedSession[]
  attendanceSessions: AttendanceSession[]
}

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

function toDateParts(date: Date, timeZone = CASABLANCA_TIME_ZONE) {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone,
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

function toDateKey(date: Date, timeZone = CASABLANCA_TIME_ZONE) {
  const parts = toDateParts(date, timeZone)
  return `${parts.year}-${String(parts.month).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}`
}

function toLocalDateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function currentTimeMinutes() {
  const formatter = new Intl.DateTimeFormat('fr-FR', {
    timeZone: CASABLANCA_TIME_ZONE,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
  const parts = formatter.formatToParts(new Date())
  const hours = Number(parts.find((part) => part.type === 'hour')?.value || '0')
  const minutes = Number(parts.find((part) => part.type === 'minute')?.value || '0')
  return (hours * 60) + minutes
}

function parseTimeToMinutes(time: string) {
  const [hours, minutes] = time.slice(0, 5).split(':').map(Number)
  return ((hours || 0) * 60) + (minutes || 0)
}

function getTeacherName(session: PlannedSession | AttendanceSession) {
  return session.teacher?.full_name || 'Professeur inconnu'
}

function getRoomName(session: PlannedSession | AttendanceSession) {
  return session.room?.name || 'Salle non assignée'
}

function getPayableMinutes(session: AttendanceSession) {
  return session.planned_duration_minutes || session.duration_minutes || 0
}

function getTeacherRateForMinutes(teacher: Teacher | undefined, minutes: number) {
  if (!teacher) return 0
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

function differencePercent(current: number, previous: number) {
  if (previous === 0) {
    return current === 0 ? 0 : 100
  }
  return round(((current - previous) / previous) * 100, 1)
}

function getWorkingDaysInMonth(year: number, month: number) {
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  let workingDays = 0

  for (let day = 1; day <= daysInMonth; day += 1) {
    const current = new Date(year, month, day)
    const weekDay = current.getDay()
    if (weekDay !== 0) {
      workingDays += 1
    }
  }

  return workingDays
}

function buildComparison(
  plannedSessions: PlannedSession[],
  attendanceSessions: AttendanceSession[],
  previousData?: MonthComparisonData,
) {
  if (!previousData) {
    return {
      sessionsChange: 0,
      hoursChange: 0,
      payrollChange: 0,
      absenceChange: 0,
      oneToOneChange: 0,
    }
  }

  const currentEffectiveSessions = plannedSessions.filter((session) => session.status !== 'cancelled')
  const previousEffectiveSessions = previousData.plannedSessions.filter((session) => session.status !== 'cancelled')
  const currentCompletedHours = currentEffectiveSessions
    .filter((session) => session.status === 'completed')
    .reduce((sum, session) => sum + session.duration_minutes, 0) / 60
  const previousCompletedHours = previousEffectiveSessions
    .filter((session) => session.status === 'completed')
    .reduce((sum, session) => sum + session.duration_minutes, 0) / 60
  const currentPayroll = attendanceSessions.reduce((sum, session) => sum + getAttendancePay(session), 0)
  const previousPayroll = previousData.attendanceSessions.reduce((sum, session) => sum + getAttendancePay(session), 0)
  const currentAbsences = currentEffectiveSessions.filter((session) => session.status === 'absent').length
  const previousAbsences = previousEffectiveSessions.filter((session) => session.status === 'absent').length
  const currentOneToOne = currentEffectiveSessions.filter((session) => session.session_type === 'one_to_one').length
  const previousOneToOne = previousEffectiveSessions.filter((session) => session.session_type === 'one_to_one').length

  return {
    sessionsChange: differencePercent(currentEffectiveSessions.length, previousEffectiveSessions.length),
    hoursChange: differencePercent(currentCompletedHours, previousCompletedHours),
    payrollChange: differencePercent(currentPayroll, previousPayroll),
    absenceChange: differencePercent(currentAbsences, previousAbsences),
    oneToOneChange: differencePercent(currentOneToOne, previousOneToOne),
  } satisfies MonthComparison
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
  const actualTotalMinutes = (actualHours * 60) + actualMinutes

  return actualTotalMinutes - plannedMinutes
}

function buildTeacherByDaySeries(sessions: PlannedSession[], keys: string[]) {
  return keys.map((key) => sessions.filter((session) => session.scheduled_date === key && session.status === 'completed').length)
}

export function computeTodayKpis(plannedSessions: PlannedSession[], attendanceSessions: AttendanceSession[]): TodayKpis {
  const todayKey = toDateKey(new Date())
  const nowMinutes = currentTimeMinutes()
  const todayPlanned = plannedSessions.filter((session) => session.scheduled_date === todayKey)
  const todayAttendance = attendanceSessions.filter((session) => toDateKey(new Date(session.created_at)) === todayKey)
  const linkedSessionIds = new Set(todayPlanned.map((session) => session.linked_session_id).filter(Boolean))
  const lateTeachers: LateTeacher[] = todayPlanned
    .filter((session) => session.status === 'scheduled')
    .map((session) => {
      const minutesLate = nowMinutes - parseTimeToMinutes(session.start_time)
      return {
        teacher_name: getTeacherName(session),
        scheduled_time: session.start_time.slice(0, 5),
        minutes_late: minutesLate,
        room: getRoomName(session),
      }
    })
    .filter((teacher) => teacher.minutes_late > 15)
    .sort((left, right) => right.minutes_late - left.minutes_late)

  const sessionsInProgress = todayPlanned.filter((session) => session.status === 'in_progress')
  const sessionsAbsent = todayPlanned.filter((session) => session.status === 'absent').length
  const sessionsScheduledRemaining = todayPlanned.filter(
    (session) => session.status === 'scheduled' && parseTimeToMinutes(session.start_time) > nowMinutes,
  ).length
  const sessionsOutOfPlanning = todayAttendance.filter((session) => !linkedSessionIds.has(session.id)).length

  return {
    sessionsInProgress: sessionsInProgress.length,
    sessionsAbsent,
    sessionsScheduledRemaining,
    sessionsOutOfPlanning,
    alertsCount: sessionsAbsent + sessionsOutOfPlanning + lateTeachers.length,
    activeRooms: Array.from(new Set(sessionsInProgress.map((session) => getRoomName(session)))),
    lateTeachers,
  }
}

export function computeWeekKpis(plannedSessions: PlannedSession[], weekStart: Date): WeekKpis {
  const weekDays = Array.from({ length: 6 }, (_, index) => {
    const current = new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate() + index)
    return {
      date: toLocalDateKey(current),
      label: current.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric' }),
    }
  })

  const effectiveSessions = plannedSessions.filter((session) => session.status !== 'cancelled')
  const totalPlanned = effectiveSessions.length
  const totalCompleted = effectiveSessions.filter((session) => session.status === 'completed').length
  const totalAbsent = effectiveSessions.filter((session) => session.status === 'absent').length
  const totalCancelled = plannedSessions.filter((session) => session.status === 'cancelled').length
  const byDay: DayKpi[] = weekDays.map((day) => {
    const daySessions = plannedSessions.filter((session) => session.scheduled_date === day.date)
    return {
      date: day.date,
      label: day.label,
      planned: daySessions.filter((session) => session.status !== 'cancelled').length,
      completed: daySessions.filter((session) => session.status === 'completed').length,
      absent: daySessions.filter((session) => session.status === 'absent').length,
    }
  })

  const teacherMap = new Map<string, TeacherWeekKpi>()

  plannedSessions.forEach((session) => {
    const teacherId = session.teacher_id
    const existing = teacherMap.get(teacherId) || {
      teacher_id: teacherId,
      teacher_name: getTeacherName(session),
      planned: 0,
      completed: 0,
      absent: 0,
      punctualityRate: 0,
      completionRate: 0,
      byDay: new Array(weekDays.length).fill(0),
    }

    if (session.status !== 'cancelled') existing.planned += 1
    if (session.status === 'completed') existing.completed += 1
    if (session.status === 'absent') existing.absent += 1

    const dayIndex = weekDays.findIndex((day) => day.date === session.scheduled_date)
    if (dayIndex >= 0 && session.status === 'completed') {
      existing.byDay[dayIndex] += 1
    }

    teacherMap.set(teacherId, existing)
  })

  const byTeacher = Array.from(teacherMap.values())
    .map((teacher) => {
      const teacherSessions = plannedSessions.filter((session) => session.teacher_id === teacher.teacher_id && session.status !== 'cancelled')
      const attendedSessions = teacherSessions.filter((session) => ['completed', 'in_progress'].includes(session.status) && session.linked_session?.start_time)
      const onTimeSessions = attendedSessions.filter((session) => {
        const difference = getSessionStartDifferenceMinutes(session)
        return difference !== null && difference <= 15
      })

      return {
        ...teacher,
        punctualityRate: attendedSessions.length ? round((onTimeSessions.length / attendedSessions.length) * 100) : 0,
        completionRate: teacher.planned ? round((teacher.completed / teacher.planned) * 100) : 0,
      }
    })
    .sort((left, right) => right.completionRate - left.completionRate || right.completed - left.completed)

  return {
    totalPlanned,
    totalCompleted,
    totalAbsent,
    totalCancelled,
    completionRate: totalPlanned ? round((totalCompleted / totalPlanned) * 100) : 0,
    absenceRate: totalPlanned ? round((totalAbsent / totalPlanned) * 100) : 0,
    byDay,
    byTeacher,
  }
}

export function computeMonthKpis(
  plannedSessions: PlannedSession[],
  attendanceSessions: AttendanceSession[],
  teachers: Teacher[],
  rooms: Room[],
  month: number,
  year: number,
  previousData?: MonthComparisonData,
): MonthKpis {
  const currentMonthPlanned = plannedSessions.filter((session) => {
    const [sessionYear, sessionMonth] = session.scheduled_date.split('-').map(Number)
    return sessionYear === year && sessionMonth === month + 1
  })
  const currentMonthAttendance = attendanceSessions.filter((session) => {
    const parts = toDateParts(new Date(session.started_at))
    return parts.year === year && parts.month === month + 1
  })

  const effectivePlanned = currentMonthPlanned.filter((session) => session.status !== 'cancelled')
  const totalPlannedHours = round(effectivePlanned.reduce((sum, session) => sum + session.duration_minutes, 0) / 60, 1)
  const totalCompletedHours = round(
    effectivePlanned
      .filter((session) => session.status === 'completed')
      .reduce((sum, session) => sum + session.duration_minutes, 0) / 60,
    1,
  )
  const totalAbsentHours = round(
    effectivePlanned
      .filter((session) => session.status === 'absent')
      .reduce((sum, session) => sum + session.duration_minutes, 0) / 60,
    1,
  )
  const totalEstimatedPayroll = round(
    currentMonthAttendance.reduce((sum, session) => {
      const teacher = teachers.find((item) => item.id === session.teacher_id)
      const teacherRate = getTeacherRateForMinutes(teacher, getPayableMinutes(session))
      return sum + getAttendancePay(session, teacherRate)
    }, 0),
    2,
  )

  const totalSessionCount = effectivePlanned.length
  const totalOneToOne = effectivePlanned.filter((session) => session.session_type === 'one_to_one').length
  const completedCount = effectivePlanned.filter((session) => session.status === 'completed').length
  const absenceCount = effectivePlanned.filter((session) => session.status === 'absent').length
  const comparison = buildComparison(currentMonthPlanned, currentMonthAttendance, previousData)
  const sparklineKeys = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(year, month, index + 1)
    return toDateKey(date, 'UTC')
  })

  const byTeacher: TeacherMonthKpi[] = teachers
    .map((teacher) => {
      const teacherPlanned = effectivePlanned.filter((session) => session.teacher_id === teacher.id)
      const teacherAttendance = currentMonthAttendance.filter((session) => session.teacher_id === teacher.id)
      const teacherCompleted = teacherPlanned.filter((session) => session.status === 'completed')
      const teacherAbsent = teacherPlanned.filter((session) => session.status === 'absent')
      const attendedSessions = teacherPlanned.filter((session) => ['completed', 'in_progress'].includes(session.status) && session.linked_session?.start_time)
      const lateCount = attendedSessions.filter((session) => {
        const difference = getSessionStartDifferenceMinutes(session)
        return difference !== null && difference > 15
      }).length
      const onTimeCount = attendedSessions.length - lateCount

      return {
        teacher_id: teacher.id,
        teacher_name: teacher.full_name,
        plannedHours: round(teacherPlanned.reduce((sum, session) => sum + session.duration_minutes, 0) / 60, 1),
        completedHours: round(teacherCompleted.reduce((sum, session) => sum + session.duration_minutes, 0) / 60, 1),
        absentHours: round(teacherAbsent.reduce((sum, session) => sum + session.duration_minutes, 0) / 60, 1),
        sessionsCount: teacherPlanned.length,
        oneToOneCount: teacherPlanned.filter((session) => session.session_type === 'one_to_one').length,
        hourlyRate: teacher.hourly_rate_short || teacher.hourly_rate,
        estimatedPayMAD: round(
          teacherAttendance.reduce(
            (sum, session) => sum + getAttendancePay(session, getTeacherRateForMinutes(teacher, getPayableMinutes(session))),
            0,
          ),
          2,
        ),
        absenceCount: teacherAbsent.length,
        lateCount,
        punctualityRate: attendedSessions.length ? round((onTimeCount / attendedSessions.length) * 100) : 0,
        completionRate: teacherPlanned.length ? round((teacherCompleted.length / teacherPlanned.length) * 100) : 0,
        byDay: buildTeacherByDaySeries(teacherCompleted, sparklineKeys),
      }
    })
    .filter((teacher) => teacher.sessionsCount > 0 || teacher.estimatedPayMAD > 0)
    .sort((left, right) => right.completionRate - left.completionRate || right.completedHours - left.completedHours)

  const workingDays = getWorkingDaysInMonth(year, month)
  const maxPossibleSessionsPerRoom = Math.max(workingDays * MAX_ROOM_SESSIONS_PER_DAY, 1)

  const byRoom: RoomKpi[] = rooms
    .map((room) => {
      const roomSessions = effectivePlanned.filter((session) => session.room_id === room.id)
      return {
        room_id: room.id,
        room_name: room.name,
        totalSessions: roomSessions.length,
        totalHours: round(roomSessions.reduce((sum, session) => sum + session.duration_minutes, 0) / 60, 1),
        occupancyRate: round((roomSessions.length / maxPossibleSessionsPerRoom) * 100, 1),
      }
    })
    .filter((room) => room.totalSessions > 0)
    .sort((left, right) => right.occupancyRate - left.occupancyRate)

  return {
    totalPlannedHours,
    totalCompletedHours,
    totalAbsentHours,
    completionRate: totalSessionCount ? round((completedCount / totalSessionCount) * 100) : 0,
    absenceRate: totalSessionCount ? round((absenceCount / totalSessionCount) * 100) : 0,
    totalEstimatedPayroll,
    averageCostPerHour: totalCompletedHours ? round(totalEstimatedPayroll / totalCompletedHours, 2) : 0,
    oneToOnePercent: totalSessionCount ? round((totalOneToOne / totalSessionCount) * 100) : 0,
    groupPercent: totalSessionCount ? round(((totalSessionCount - totalOneToOne) / totalSessionCount) * 100) : 0,
    byTeacher,
    byRoom,
    vsLastMonth: comparison,
  }
}
