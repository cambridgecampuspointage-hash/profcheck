import type {
  ReceptionAnomaly,
  ReceptionDayKpis,
  ReceptionMonthSummaryRow,
  StaffAttendance,
  StaffSchedule,
} from '@/types/reception'

function minutesBetween(start: string, end: string) {
  const [startHours, startMinutes] = start.slice(0, 5).split(':').map(Number)
  const [endHours, endMinutes] = end.slice(0, 5).split(':').map(Number)
  return (((endHours || 0) * 60) + (endMinutes || 0)) - (((startHours || 0) * 60) + (startMinutes || 0))
}

function extractTime(value: string | null) {
  if (!value) return null
  if (/^\d{2}:\d{2}/.test(value)) return value.slice(0, 5)
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return date.toLocaleTimeString('fr-FR', {
    timeZone: 'Africa/Casablanca',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
}

export function minutesToLabel(minutes: number) {
  const safeMinutes = Math.max(0, minutes)
  const hours = Math.floor(safeMinutes / 60)
  const remainder = safeMinutes % 60
  if (hours === 0) return `${remainder} min`
  if (remainder === 0) return `${hours}h`
  return `${hours}h${String(remainder).padStart(2, '0')}`
}

export function getWeekdayIndex(date: Date) {
  const index = date.getDay()
  return index === 0 ? 6 : index - 1
}

export function findScheduleForDate(schedules: StaffSchedule[], date: Date) {
  const weekday = getWeekdayIndex(date)
  return schedules.find((schedule) => schedule.work_days.includes(weekday)) || null
}

export function computeBreakMinutes(attendance: StaffAttendance | null, now = new Date()) {
  if (!attendance?.break_start) return 0
  const breakStart = extractTime(attendance.break_start)
  const breakEnd = extractTime(attendance.break_end)
  const nowTime = now.toLocaleTimeString('fr-FR', {
    timeZone: 'Africa/Casablanca',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })

  if (!breakStart) return 0
  return minutesBetween(breakStart, breakEnd || nowTime)
}

export function computeDayAttendanceKpis(
  schedule: StaffSchedule | null,
  attendance: StaffAttendance | null,
  now = new Date(),
): ReceptionDayKpis {
  const breakMinutes = computeBreakMinutes(attendance, now)
  const lateMinutes = attendance?.late_minutes || 0
  const earlyLeaveMinutes = attendance?.early_leave_minutes || 0
  const breakOvertimeMinutes = attendance?.break_overtime_minutes || 0
  const anomalies: ReceptionAnomaly[] = []

  if (lateMinutes > 0) {
    anomalies.push({
      type: 'late_arrival' as const,
      title: 'Retard à l’arrivée',
      severity: lateMinutes >= 15 ? 'critical' : 'warning',
      message: `${lateMinutes} min de retard à l’arrivée`,
      minutes: lateMinutes,
    })
  }

  if (breakOvertimeMinutes > 0) {
    anomalies.push({
      type: 'long_break' as const,
      title: 'Pause excessive',
      severity: 'warning',
      message: `${breakOvertimeMinutes} min au-delà de la pause autorisée`,
      minutes: breakOvertimeMinutes,
    })
  }

  if (earlyLeaveMinutes > 0) {
    anomalies.push({
      type: 'early_leave' as const,
      title: 'Départ anticipé',
      severity: 'warning',
      message: `${earlyLeaveMinutes} min avant l’horaire prévu`,
      minutes: earlyLeaveMinutes,
    })
  }

  if (attendance?.status === 'absent') {
    anomalies.push({
      type: 'absence' as const,
      title: 'Absence',
      severity: 'critical',
      message: 'Aucun pointage d’arrivée enregistré',
      minutes: 0,
    })
  }

  if (attendance?.clock_in && !attendance.clock_out && attendance.status !== 'on_break') {
    const currentTime = now.toLocaleTimeString('fr-FR', {
      timeZone: 'Africa/Casablanca',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    })
    if (schedule && minutesBetween(schedule.expected_end, currentTime) >= 30) {
      anomalies.push({
        type: 'missing_clock_out' as const,
        title: 'Départ non pointé',
        severity: 'critical',
        message: 'La fin de journée est dépassée sans pointage départ',
        minutes: minutesBetween(schedule.expected_end, currentTime),
      })
    }
  }

  const statusTone =
    attendance?.status === 'completed'
      ? 'success'
      : attendance?.status === 'absent'
        ? 'danger'
        : attendance?.status === 'late' || breakOvertimeMinutes > 0 || earlyLeaveMinutes > 0
          ? 'warning'
          : 'neutral'

  return {
    expectedRange: schedule ? `${schedule.expected_start.slice(0, 5)} → ${schedule.expected_end.slice(0, 5)}` : 'Aucun horaire prévu',
    actualRange: attendance?.clock_in
      ? `${extractTime(attendance.clock_in) || '—'} → ${extractTime(attendance.clock_out) || 'En cours'}`
      : 'Aucun pointage',
    totalPresentLabel: minutesToLabel(attendance?.total_present_minutes || 0),
    breakLabel: breakMinutes > 0 ? minutesToLabel(breakMinutes) : 'Aucune pause',
    statusLabel:
      attendance?.status === 'on_break'
        ? 'En pause'
        : attendance?.status === 'completed'
          ? 'Journée terminée'
          : attendance?.status === 'late'
            ? 'Arrivée enregistrée avec retard'
            : attendance?.status === 'absent'
              ? 'Absence détectée'
              : attendance?.clock_in
                ? 'Présente'
                : 'En attente de pointage',
    statusTone,
    clockedIn: Boolean(attendance?.clock_in),
    onBreak: Boolean(attendance?.break_start && !attendance?.break_end),
    completed: Boolean(attendance?.clock_out),
    lateMinutes,
    earlyLeaveMinutes,
    breakOvertimeMinutes,
    anomalies,
  }
}

export function computeReceptionMonthSummary(
  schedules: StaffSchedule[],
  attendances: StaffAttendance[],
): ReceptionMonthSummaryRow[] {
  const summaryMap = new Map<string, ReceptionMonthSummaryRow>()

  for (const schedule of schedules) {
    if (!summaryMap.has(schedule.user_id)) {
      summaryMap.set(schedule.user_id, {
        user_id: schedule.user_id,
        full_name: schedule.profile?.full_name || 'Réceptionniste',
        workedDays: 0,
        lateCount: 0,
        absenceCount: 0,
        longBreakCount: 0,
        earlyLeaveCount: 0,
        missingClockOutCount: 0,
        totalPresentMinutes: 0,
        averagePresentMinutes: 0,
        lateDetails: [],
        absenceDetails: [],
        longBreakDetails: [],
        earlyLeaveDetails: [],
        missingClockOutDetails: [],
      })
    }
  }

  for (const attendance of attendances) {
    const row = summaryMap.get(attendance.user_id)
    if (!row) continue

    row.workedDays += attendance.clock_in ? 1 : 0
    row.totalPresentMinutes += attendance.total_present_minutes || 0
    if (attendance.late_minutes > 0) {
      row.lateCount += 1
      row.lateDetails.push({
        date: attendance.date,
        minutes: attendance.late_minutes,
        label: `${attendance.late_minutes} min de retard`,
      })
    }

    if (attendance.status === 'absent') {
      row.absenceCount += 1
      row.absenceDetails.push({
        date: attendance.date,
        label: 'Absence constatée',
      })
    }

    if (attendance.break_overtime_minutes > 0) {
      row.longBreakCount += 1
      row.longBreakDetails.push({
        date: attendance.date,
        minutes: attendance.break_overtime_minutes,
        label: `${attendance.break_overtime_minutes} min de dépassement`,
      })
    }

    if (attendance.early_leave_minutes > 0) {
      row.earlyLeaveCount += 1
      row.earlyLeaveDetails.push({
        date: attendance.date,
        minutes: attendance.early_leave_minutes,
        label: `${attendance.early_leave_minutes} min de départ anticipé`,
      })
    }

    if (attendance.clock_in && !attendance.clock_out) {
      row.missingClockOutCount += 1
      row.missingClockOutDetails.push({
        date: attendance.date,
        label: 'Sortie non pointée',
      })
    }
  }

  return Array.from(summaryMap.values())
    .map((row) => ({
      ...row,
      averagePresentMinutes: row.workedDays ? Math.round(row.totalPresentMinutes / row.workedDays) : 0,
    }))
    .sort((left, right) => left.full_name.localeCompare(right.full_name))
}
