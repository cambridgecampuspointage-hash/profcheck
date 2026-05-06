import {
  alreadySentToday,
  logAlertToSupabase,
  sendTelegramMessage,
} from '@/lib/telegram/sendAlert'
import {
  buildStaffAbsentMessage,
  buildStaffEarlyLeaveMessage,
  buildStaffLateMessage,
  buildStaffLongBreakMessage,
} from '@/lib/telegram/alertMessages'
import type { StaffAttendance, StaffSchedule } from '@/types/reception'

export function timeDiffMinutes(time1: string, time2: string): number {
  const [hours1, minutes1] = time1.slice(0, 5).split(':').map(Number)
  const [hours2, minutes2] = time2.slice(0, 5).split(':').map(Number)
  return (((hours2 || 0) * 60) + (minutes2 || 0)) - (((hours1 || 0) * 60) + (minutes1 || 0))
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

function formatFrenchDay(dateIso: string) {
  const [year, month, day] = dateIso.split('-').map(Number)
  return new Date(year, (month || 1) - 1, day || 1).toLocaleDateString('fr-FR', {
    timeZone: 'Africa/Casablanca',
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

async function sendAndLogReceptionAlert(params: {
  alertType: string
  referenceId: string
  referenceDate: string
  messageText: string
}) {
  const result = await sendTelegramMessage(params.messageText)
  await logAlertToSupabase({
    alertType: params.alertType,
    referenceId: params.referenceId,
    referenceDate: params.referenceDate,
    messageText: params.messageText,
    result,
  })
  return result.ok
}

export function detectLateArrival(
  schedule: StaffSchedule,
  clockInTime: string,
) {
  const minutesLate = timeDiffMinutes(schedule.expected_start, clockInTime)
  return minutesLate > 0 ? minutesLate : 0
}

export function detectEarlyLeave(
  schedule: StaffSchedule,
  clockOutTime: string,
) {
  const minutesEarly = timeDiffMinutes(clockOutTime, schedule.expected_end)
  return minutesEarly > 10 ? minutesEarly : 0
}

export function detectLongBreak(
  schedule: StaffSchedule,
  attendance: StaffAttendance,
  nowTime: string,
) {
  const breakStart = extractTime(attendance.break_start)
  if (!breakStart || attendance.break_end) return 0
  const breakDuration = timeDiffMinutes(breakStart, nowTime)
  return breakDuration > schedule.max_break_minutes ? breakDuration : 0
}

export function detectAbsence(
  schedule: StaffSchedule,
  attendance: StaffAttendance | null,
  nowTime: string,
) {
  if (attendance?.clock_in) return 0
  const minutesLate = timeDiffMinutes(schedule.expected_start, nowTime)
  return minutesLate >= 30 ? minutesLate : 0
}

export function detectMissingClockOut(
  schedule: StaffSchedule,
  attendance: StaffAttendance | null,
  nowTime: string,
) {
  if (!attendance?.clock_in || attendance.clock_out) return 0
  const minutesPastEnd = timeDiffMinutes(schedule.expected_end, nowTime)
  return minutesPastEnd >= 30 ? minutesPastEnd : 0
}

export async function notifyLateArrival(params: {
  schedule: StaffSchedule
  attendance: StaffAttendance
  staffName: string
}) {
  const clockIn = extractTime(params.attendance.clock_in)
  if (!clockIn) return false

  const minutesLate = detectLateArrival(params.schedule, clockIn)
  if (minutesLate <= 0) return false

  const alreadySent = await alreadySentToday('staff_late', params.attendance.id, params.attendance.date)
  if (alreadySent) return false

  return sendAndLogReceptionAlert({
    alertType: 'staff_late',
    referenceId: params.attendance.id,
    referenceDate: params.attendance.date,
    messageText: buildStaffLateMessage({
      staffName: params.staffName,
      expectedStart: params.schedule.expected_start.slice(0, 5),
      minutesLate,
      date: formatFrenchDay(params.attendance.date),
    }),
  })
}

export async function notifyEarlyLeave(params: {
  schedule: StaffSchedule
  attendance: StaffAttendance
  staffName: string
}) {
  const clockOut = extractTime(params.attendance.clock_out)
  if (!clockOut) return false
  const minutesEarly = detectEarlyLeave(params.schedule, clockOut)
  if (minutesEarly <= 0) return false

  const alreadySent = await alreadySentToday('staff_early_leave', params.attendance.id, params.attendance.date)
  if (alreadySent) return false

  return sendAndLogReceptionAlert({
    alertType: 'staff_early_leave',
    referenceId: params.attendance.id,
    referenceDate: params.attendance.date,
    messageText: buildStaffEarlyLeaveMessage({
      staffName: params.staffName,
      clockOut,
      expectedEnd: params.schedule.expected_end.slice(0, 5),
      minutesEarly,
      date: formatFrenchDay(params.attendance.date),
    }),
  })
}

export async function notifyLongBreak(params: {
  schedule: StaffSchedule
  attendance: StaffAttendance
  staffName: string
  nowTime: string
}) {
  const breakStart = extractTime(params.attendance.break_start)
  if (!breakStart) return false
  const breakDuration = detectLongBreak(params.schedule, params.attendance, params.nowTime)
  if (breakDuration <= 0) return false

  const alreadySent = await alreadySentToday('staff_long_break', params.attendance.id, params.attendance.date)
  if (alreadySent) return false

  return sendAndLogReceptionAlert({
    alertType: 'staff_long_break',
    referenceId: params.attendance.id,
    referenceDate: params.attendance.date,
    messageText: buildStaffLongBreakMessage({
      staffName: params.staffName,
      breakStart,
      currentDuration: breakDuration,
      maxAllowed: params.schedule.max_break_minutes,
      date: formatFrenchDay(params.attendance.date),
    }),
  })
}

export async function notifyAbsence(params: {
  schedule: StaffSchedule
  attendance: StaffAttendance | null
  staffName: string
  today: string
  nowTime: string
}) {
  const minutesLate = detectAbsence(params.schedule, params.attendance, params.nowTime)
  if (minutesLate <= 0) return false

  const referenceId = params.attendance?.id || params.schedule.id
  const alreadySent = await alreadySentToday('staff_absent', referenceId, params.today)
  if (alreadySent) return false

  return sendAndLogReceptionAlert({
    alertType: 'staff_absent',
    referenceId,
    referenceDate: params.today,
    messageText: buildStaffAbsentMessage({
      staffName: params.staffName,
      expectedStart: params.schedule.expected_start.slice(0, 5),
      date: formatFrenchDay(params.today),
    }),
  })
}
