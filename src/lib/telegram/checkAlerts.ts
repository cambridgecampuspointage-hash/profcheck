import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import {
  alreadySentToday,
  logAlertToSupabase,
  sendTelegramMessage,
} from './sendAlert'
import {
  buildDailySummaryMessage,
  buildOutOfPlanningMessage,
  buildStaffAbsentMessage,
  buildStaffEarlyLeaveMessage,
  buildStaffLateMessage,
  buildStaffLongBreakMessage,
  buildTeacherAbsentMessage,
  buildTeacherLateMessage,
} from './alertMessages'

type StaffSchedule = {
  id: string
  user_id: string
  role: string
  expected_start: string
  expected_end: string
  max_break_minutes: number
  work_days: unknown
}

type StaffAttendance = {
  id: string
  user_id: string
  date: string
  clock_in: string | null
  clock_out: string | null
  break_start: string | null
  break_end: string | null
  total_present_minutes: number | null
  status: string | null
}

type TeacherSession = {
  id: string
  scheduled_date: string
  start_time: string
  status: string
  teacher: { full_name: string } | null
  room: { name: string } | null
}

type AttendanceEvent = {
  id: string
  created_at: string
  started_at: string
  linked_session_id: string | null
  teacher: { full_name: string } | null
  room: { name: string } | null
}

type AppSettingsRow = {
  auto_close_active_sessions: boolean
  auto_close_after_minutes: number
}

function createServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

export function getAlertsSupabaseClient() {
  return createServiceClient()
}

export function timeDiffMinutes(time1: string, time2: string): number {
  const [hours1, minutes1] = time1.slice(0, 5).split(':').map(Number)
  const [hours2, minutes2] = time2.slice(0, 5).split(':').map(Number)
  return (((hours2 || 0) * 60) + (minutes2 || 0)) - (((hours1 || 0) * 60) + (minutes1 || 0))
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

function formatTimeValue(value: string) {
  return value.slice(0, 5)
}

function extractTime(input: string | null | undefined) {
  if (!input) return null
  if (/^\d{2}:\d{2}/.test(input)) return input.slice(0, 5)
  const date = new Date(input)
  if (Number.isNaN(date.getTime())) return null
  return date.toLocaleTimeString('fr-FR', {
    timeZone: 'Africa/Casablanca',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
}

function dateRangeUtc(today: string) {
  const [year, month, day] = today.split('-').map(Number)
  const next = new Date(year, (month || 1) - 1, (day || 1) + 1)
  const nextIso = `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}-${String(next.getDate()).padStart(2, '0')}`
  return {
    startIso: new Date(`${today}T00:00:00+01:00`).toISOString(),
    endIso: new Date(`${nextIso}T00:00:00+01:00`).toISOString(),
  }
}

function currentWeekdayIndex(today: string) {
  const [year, month, day] = today.split('-').map(Number)
  const date = new Date(year, (month || 1) - 1, day || 1)
  const dayIndex = date.getDay()
  return dayIndex === 0 ? 6 : dayIndex - 1
}

function parseWorkDays(value: unknown): number[] {
  if (Array.isArray(value)) {
    return value
      .map((entry) => {
        if (typeof entry === 'number') return entry
        if (typeof entry === 'string') {
          const trimmed = entry.trim().toLowerCase()
          const numeric = Number(trimmed)
          if (!Number.isNaN(numeric)) return numeric
          const map: Record<string, number> = {
            lundi: 0,
            mardi: 1,
            mercredi: 2,
            jeudi: 3,
            vendredi: 4,
            samedi: 5,
            sunday: 6,
            monday: 0,
            tuesday: 1,
            wednesday: 2,
            thursday: 3,
            friday: 4,
            saturday: 5,
            sunday_fr: 6,
          }
          return map[trimmed]
        }
        return undefined
      })
      .filter((entry): entry is number => typeof entry === 'number' && entry >= 0 && entry <= 6)
  }

  if (typeof value === 'string') {
    const cleaned = value.replace(/[{}"]/g, '')
    if (!cleaned) return []
    return parseWorkDays(cleaned.split(',').map((item) => item.trim()))
  }

  return []
}

async function safeSendAndLog(params: {
  alertType: string
  referenceId?: string
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

export async function checkTeacherAlerts(
  supabase: SupabaseClient,
  today: string,
  nowTime: string,
): Promise<number> {
  let alertsSent = 0

  const { data, error } = await supabase
    .from('planned_sessions')
    .select('id, scheduled_date, start_time, status, teacher:teachers(full_name), room:rooms(name)')
    .eq('scheduled_date', today)
    .eq('status', 'scheduled')
    .lt('start_time', nowTime)
    .order('start_time')

  if (error) {
    console.error('[telegram] checkTeacherAlerts:', error.message)
    return 0
  }

  const sessions = (data || []) as unknown as TeacherSession[]

  for (const session of sessions) {
    const minutesLate = timeDiffMinutes(session.start_time, nowTime)
    const teacherName = session.teacher?.full_name || 'Professeur inconnu'
    const roomName = session.room?.name || 'Salle non assignée'
    const dateLabel = formatFrenchDay(session.scheduled_date)

    if (minutesLate >= 30) {
      const alreadySent = await alreadySentToday('teacher_absent', session.id, today)
      if (alreadySent) continue

      const messageText = buildTeacherAbsentMessage({
        teacherName,
        scheduledTime: formatTimeValue(session.start_time),
        roomName,
        date: dateLabel,
      })

      const sent = await safeSendAndLog({
        alertType: 'teacher_absent',
        referenceId: session.id,
        referenceDate: today,
        messageText,
      })

      if (sent) {
        alertsSent += 1
        await supabase
          .from('planned_sessions')
          .update({ status: 'absent' })
          .eq('id', session.id)
      }
      continue
    }

    if (minutesLate >= 15) {
      const alreadySent = await alreadySentToday('teacher_late', session.id, today)
      if (alreadySent) continue

      const messageText = buildTeacherLateMessage({
        teacherName,
        scheduledTime: formatTimeValue(session.start_time),
        minutesLate,
        roomName,
        date: dateLabel,
      })

      const sent = await safeSendAndLog({
        alertType: 'teacher_late',
        referenceId: session.id,
        referenceDate: today,
        messageText,
      })

      if (sent) {
        alertsSent += 1
      }
    }
  }

  return alertsSent
}

export async function checkOutOfPlanningAlerts(
  supabase: SupabaseClient,
  today: string,
): Promise<number> {
  let alertsSent = 0
  const { startIso, endIso } = dateRangeUtc(today)

  const { data, error } = await supabase
    .from('attendance_sessions')
    .select('id, created_at, started_at, linked_session_id, teacher:teachers(full_name), room:rooms(name)')
    .is('linked_session_id', null)
    .gte('created_at', startIso)
    .lt('created_at', endIso)
    .order('created_at')

  if (error) {
    console.error('[telegram] checkOutOfPlanningAlerts:', error.message)
    return 0
  }

  const sessions = (data || []) as unknown as AttendanceEvent[]

  for (const session of sessions) {
    const alreadySent = await alreadySentToday('out_of_planning', session.id, today)
    if (alreadySent) continue

    const messageText = buildOutOfPlanningMessage({
      teacherName: session.teacher?.full_name || 'Professeur inconnu',
      scanTime: extractTime(session.started_at) || extractTime(session.created_at) || '—',
      roomName: session.room?.name || 'Salle non assignée',
      date: formatFrenchDay(today),
    })

    const sent = await safeSendAndLog({
      alertType: 'out_of_planning',
      referenceId: session.id,
      referenceDate: today,
      messageText,
    })

    if (sent) {
      alertsSent += 1
    }
  }

  return alertsSent
}

export async function checkStaffAlerts(
  supabase: SupabaseClient,
  today: string,
  nowTime: string,
): Promise<number> {
  let alertsSent = 0
  const weekday = currentWeekdayIndex(today)

  const { data: schedulesData, error: schedulesError } = await supabase
    .from('staff_schedules')
    .select('id, user_id, role, expected_start, expected_end, max_break_minutes, work_days')
    .eq('role', 'reception')

  if (schedulesError) {
    console.error('[telegram] checkStaffAlerts schedules:', schedulesError.message)
    return 0
  }

  const schedules = (schedulesData || []) as unknown as StaffSchedule[]
  if (schedules.length === 0) return 0

  const userIds = schedules.map((schedule) => schedule.user_id)
  const [profilesResult, attendanceResult] = await Promise.all([
    supabase
      .from('profiles')
      .select('id, full_name')
      .in('id', userIds),
    supabase
      .from('staff_attendance')
      .select('id, user_id, date, clock_in, clock_out, break_start, break_end, total_present_minutes, status')
      .eq('date', today)
      .in('user_id', userIds),
  ])

  if (profilesResult.error || attendanceResult.error) {
    console.error('[telegram] checkStaffAlerts profiles/attendance:', profilesResult.error?.message || attendanceResult.error?.message)
    return 0
  }

  const profiles = new Map<string, { full_name: string | null }>(
    ((profilesResult.data || []) as Array<{ id: string; full_name: string | null }>).map((profile) => [
      profile.id,
      { full_name: profile.full_name },
    ]),
  )
  const attendances = new Map<string, StaffAttendance>(
    ((attendanceResult.data || []) as unknown as StaffAttendance[]).map((attendance) => [attendance.user_id, attendance]),
  )

  for (const schedule of schedules) {
    const workDays = parseWorkDays(schedule.work_days)
    if (workDays.length > 0 && !workDays.includes(weekday)) {
      continue
    }

    const attendance = attendances.get(schedule.user_id)
    const staffName = profiles.get(schedule.user_id)?.full_name || 'Réceptionniste'
    const dateLabel = formatFrenchDay(today)
    const minutesLate = timeDiffMinutes(schedule.expected_start, nowTime)

    if (!attendance) {
      if (minutesLate >= 30) {
        const alreadySent = await alreadySentToday('staff_absent', schedule.id, today)
        if (!alreadySent) {
          const sent = await safeSendAndLog({
            alertType: 'staff_absent',
            referenceId: schedule.id,
            referenceDate: today,
            messageText: buildStaffAbsentMessage({
              staffName,
              expectedStart: formatTimeValue(schedule.expected_start),
              date: dateLabel,
            }),
          })

          if (sent) alertsSent += 1
        }
      } else if (minutesLate >= 15) {
        const alreadySent = await alreadySentToday('staff_late', schedule.id, today)
        if (!alreadySent) {
          const sent = await safeSendAndLog({
            alertType: 'staff_late',
            referenceId: schedule.id,
            referenceDate: today,
            messageText: buildStaffLateMessage({
              staffName,
              expectedStart: formatTimeValue(schedule.expected_start),
              minutesLate,
              date: dateLabel,
            }),
          })

          if (sent) alertsSent += 1
        }
      }

      continue
    }

    if (attendance.break_start && !attendance.break_end) {
      const breakStart = extractTime(attendance.break_start)
      if (breakStart) {
        const breakDuration = timeDiffMinutes(breakStart, nowTime)
        if (breakDuration > schedule.max_break_minutes) {
          const alreadySent = await alreadySentToday('staff_long_break', attendance.id, today)
          if (!alreadySent) {
            const sent = await safeSendAndLog({
              alertType: 'staff_long_break',
              referenceId: attendance.id,
              referenceDate: today,
              messageText: buildStaffLongBreakMessage({
                staffName,
                breakStart,
                currentDuration: breakDuration,
                maxAllowed: schedule.max_break_minutes,
                date: dateLabel,
              }),
            })

            if (sent) alertsSent += 1
          }
        }
      }
    }

    if (attendance.clock_out) {
      const clockOut = extractTime(attendance.clock_out)
      if (clockOut) {
        const minutesEarly = timeDiffMinutes(clockOut, formatTimeValue(schedule.expected_end))
        if (minutesEarly > 10) {
          const alreadySent = await alreadySentToday('staff_early_leave', attendance.id, today)
          if (!alreadySent) {
            const sent = await safeSendAndLog({
              alertType: 'staff_early_leave',
              referenceId: attendance.id,
              referenceDate: today,
              messageText: buildStaffEarlyLeaveMessage({
                staffName,
                clockOut,
                expectedEnd: formatTimeValue(schedule.expected_end),
                minutesEarly,
                date: dateLabel,
              }),
            })

            if (sent) alertsSent += 1
          }
        }
      }
    }
  }

  return alertsSent
}

function minutesToHoursMinutes(minutes: number) {
  const hours = Math.floor(minutes / 60)
  const remainder = minutes % 60
  if (hours === 0) return `${remainder}min`
  if (remainder === 0) return `${hours}h`
  return `${hours}h${String(remainder).padStart(2, '0')}`
}

export async function buildDailySummary(
  supabase: SupabaseClient,
  today: string,
): Promise<void> {
  const duplicateCheck = await supabase
    .from('telegram_alerts_log')
    .select('id')
    .eq('alert_type', 'daily_summary')
    .eq('reference_date', today)
    .is('reference_id', null)
    .maybeSingle()

  if (duplicateCheck.error) {
    console.error('[telegram] buildDailySummary anti-spam:', duplicateCheck.error.message)
    return
  }

  if (duplicateCheck.data?.id) {
    return
  }

  const { startIso, endIso } = dateRangeUtc(today)

  const [completedResult, absentResult, outOfPlanningResult, staffResult, alertsResult] = await Promise.all([
    supabase
      .from('planned_sessions')
      .select('id', { count: 'exact', head: true })
      .eq('scheduled_date', today)
      .eq('status', 'completed'),
    supabase
      .from('planned_sessions')
      .select('id', { count: 'exact', head: true })
      .eq('scheduled_date', today)
      .eq('status', 'absent'),
    supabase
      .from('attendance_sessions')
      .select('id', { count: 'exact', head: true })
      .is('linked_session_id', null)
      .gte('created_at', startIso)
      .lt('created_at', endIso),
    supabase
      .from('staff_attendance')
      .select('id, total_present_minutes, clock_in, clock_out')
      .eq('date', today),
    supabase
      .from('telegram_alerts_log')
      .select('id', { count: 'exact', head: true })
      .eq('reference_date', today),
  ])

  if (
    completedResult.error ||
    absentResult.error ||
    outOfPlanningResult.error ||
    staffResult.error ||
    alertsResult.error
  ) {
    console.error('[telegram] buildDailySummary counts:', completedResult.error?.message || absentResult.error?.message || outOfPlanningResult.error?.message || staffResult.error?.message || alertsResult.error?.message)
    return
  }

  const staffRows = (staffResult.data || []) as Array<{
    total_present_minutes: number | null
    clock_in: string | null
    clock_out: string | null
  }>
  const totalStaffMinutes = staffRows.reduce((sum, row) => sum + (row.total_present_minutes || 0), 0)
  const staffPresent = staffRows.some((row) => Boolean(row.clock_in))
  const messageText = buildDailySummaryMessage({
    date: formatFrenchDay(today),
    completedSessions: completedResult.count || 0,
    absentTeachers: absentResult.count || 0,
    outOfPlanning: outOfPlanningResult.count || 0,
    staffPresent,
    staffHours: minutesToHoursMinutes(totalStaffMinutes),
    totalAlertsToday: alertsResult.count || 0,
  })

  await safeSendAndLog({
    alertType: 'daily_summary',
    referenceDate: today,
    messageText,
  })
}

export async function autoCloseForgottenAttendanceSessions(
  supabase: SupabaseClient,
): Promise<number> {
  const { data: settings } = await supabase
    .from('app_settings')
    .select('auto_close_active_sessions, auto_close_after_minutes')
    .eq('id', 'global')
    .maybeSingle()

  const appSettings = settings as AppSettingsRow | null
  if (!appSettings?.auto_close_active_sessions) return 0

  const thresholdDate = new Date(Date.now() - appSettings.auto_close_after_minutes * 60_000).toISOString()

  const { data: sessions, error } = await supabase
    .from('attendance_sessions')
    .select('id, started_at, status')
    .eq('status', 'active')
    .lte('started_at', thresholdDate)

  if (error) {
    console.error('[telegram] autoCloseForgottenAttendanceSessions:', error.message)
    return 0
  }

  const staleSessions = (sessions || []) as Array<{ id: string; started_at: string; status: string }>
  let closedCount = 0

  for (const session of staleSessions) {
    const endedAt = new Date()
    const startedAt = new Date(session.started_at)
    const durationMinutes = Math.max(0, Math.round((endedAt.getTime() - startedAt.getTime()) / 60000))

    const { error: updateError } = await supabase
      .from('attendance_sessions')
      .update({
        ended_at: endedAt.toISOString(),
        duration_minutes: durationMinutes,
        end_status: 'auto_closed',
        status: 'completed',
      })
      .eq('id', session.id)
      .eq('status', 'active')

    if (updateError) {
      console.error('[telegram] autoCloseForgottenAttendanceSessions update:', updateError.message)
      continue
    }

    await supabase
      .from('planned_sessions')
      .update({ status: 'completed' })
      .eq('linked_session_id', session.id)
      .in('status', ['scheduled', 'in_progress'])

    closedCount += 1
  }

  return closedCount
}
