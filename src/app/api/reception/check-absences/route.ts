import { NextResponse } from 'next/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import {
  detectMissingClockOut,
  notifyAbsence,
  notifyLongBreak,
} from '@/lib/reception/detectAnomalies'
import type { StaffAttendance, StaffSchedule } from '@/types/reception'

function createServiceClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

function isAuthorized(request: Request) {
  const header = request.headers.get('authorization')
  const expected = process.env.CRON_SECRET
  return Boolean(expected && header === `Bearer ${expected}`)
}

function getTodayInfo() {
  const now = new Date()
  return {
    today: now.toLocaleDateString('fr-CA', { timeZone: 'Africa/Casablanca' }),
    nowTime: now.toLocaleTimeString('fr-FR', {
      timeZone: 'Africa/Casablanca',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }),
    weekday: (() => {
      const day = now.getDay()
      return day === 0 ? 6 : day - 1
    })(),
  }
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ ok: false, error: 'Non autorisé' }, { status: 401 })
  }

  const service = createServiceClient()
  const { today, nowTime, weekday } = getTodayInfo()

  const [{ data: schedulesData, error: schedulesError }, { data: attendancesData, error: attendancesError }, { data: profilesData, error: profilesError }] = await Promise.all([
    service.from('staff_schedules').select('*').eq('role', 'reception'),
    service.from('staff_attendance').select('*').eq('date', today),
    service.from('profiles').select('id, full_name, email, role').eq('role', 'reception'),
  ])

  if (schedulesError || attendancesError || profilesError) {
    return NextResponse.json({
      ok: false,
      error: schedulesError?.message || attendancesError?.message || profilesError?.message || 'Vérification impossible.',
    }, { status: 500 })
  }

  const schedules = (schedulesData || []) as unknown as StaffSchedule[]
  const attendances = new Map<string, StaffAttendance>(
    ((attendancesData || []) as unknown as StaffAttendance[]).map((attendance) => [attendance.user_id, attendance]),
  )
  const profiles = new Map<string, { full_name: string | null }>(
    ((profilesData || []) as Array<{ id: string; full_name: string | null }>).map((profile) => [profile.id, { full_name: profile.full_name }]),
  )

  let alertsSent = 0

  for (const schedule of schedules) {
    if (!schedule.work_days.includes(weekday)) continue

    const attendance = attendances.get(schedule.user_id) || null
    const staffName = profiles.get(schedule.user_id)?.full_name || 'Réceptionniste'

    if (await notifyAbsence({ schedule, attendance, staffName, today, nowTime })) {
      alertsSent += 1
      if (!attendance) {
        await service.from('staff_attendance').upsert({
          user_id: schedule.user_id,
          date: today,
          status: 'absent',
        }, { onConflict: 'user_id,date' })
      } else {
        await service.from('staff_attendance').update({ status: 'absent' }).eq('id', attendance.id)
      }
      continue
    }

    if (attendance && await notifyLongBreak({ schedule, attendance, staffName, nowTime })) {
      alertsSent += 1
    }

    if (attendance && detectMissingClockOut(schedule, attendance, nowTime) > 0) {
      const { alreadySentToday, logAlertToSupabase, sendTelegramMessage } = await import('@/lib/telegram/sendAlert')
      const { buildStaffMissingClockOutMessage } = await import('@/lib/telegram/alertMessages')
      const alreadySent = await alreadySentToday('staff_missing_clock_out', attendance.id, today)
      if (!alreadySent) {
        const messageText = buildStaffMissingClockOutMessage({
          staffName,
          expectedEnd: schedule.expected_end.slice(0, 5),
          date: new Date(today).toLocaleDateString('fr-FR', {
            timeZone: 'Africa/Casablanca',
            weekday: 'long',
            day: 'numeric',
            month: 'long',
            year: 'numeric',
          }),
        })
        const result = await sendTelegramMessage(messageText)
        await logAlertToSupabase({
          alertType: 'staff_missing_clock_out',
          referenceId: attendance.id,
          referenceDate: today,
          messageText,
          result,
        })
        if (result.ok) alertsSent += 1
      }
    }
  }

  return NextResponse.json({
    ok: true,
    checked_at: new Date().toISOString(),
    alerts_sent: alertsSent,
  })
}
