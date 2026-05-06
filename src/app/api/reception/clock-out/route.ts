import { NextResponse } from 'next/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { findScheduleForDate } from '@/lib/reception/computeReceptionKpis'
import { notifyEarlyLeave } from '@/lib/reception/detectAnomalies'
import type { StaffAttendance, StaffSchedule } from '@/types/reception'

function createServiceClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

function getTodayInfo() {
  const now = new Date()
  return {
    now,
    nowIso: now.toISOString(),
    today: now.toLocaleDateString('fr-CA', { timeZone: 'Africa/Casablanca' }),
  }
}

function extractTime(dateIso: string) {
  return new Date(dateIso).toLocaleTimeString('fr-FR', {
    timeZone: 'Africa/Casablanca',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
}

function timeToMinutes(value: string) {
  const [hours, minutes] = value.slice(0, 5).split(':').map(Number)
  return ((hours || 0) * 60) + (minutes || 0)
}

export async function POST() {
  const sessionClient = await createClient()
  const {
    data: { user },
  } = await sessionClient.auth.getUser()

  if (!user) {
    return NextResponse.json({ ok: false, error: 'Non authentifié' }, { status: 401 })
  }

  const { data: profile } = await sessionClient
    .from('profiles')
    .select('id, role, full_name')
    .eq('id', user.id)
    .single()

  if (!profile || (profile.role !== 'reception' && profile.role !== 'admin')) {
    return NextResponse.json({ ok: false, error: 'Accès refusé' }, { status: 403 })
  }

  const service = createServiceClient()
  const { now, nowIso, today } = getTodayInfo()

  const [{ data: schedulesData, error: scheduleError }, { data: attendanceData, error: attendanceError }] = await Promise.all([
    service
      .from('staff_schedules')
      .select('*, profile:profiles!staff_schedules_user_id_fkey(id, full_name, email, role)')
      .eq('user_id', profile.id),
    service
      .from('staff_attendance')
      .select('*')
      .eq('user_id', profile.id)
      .eq('date', today)
      .maybeSingle(),
  ])

  if (scheduleError || attendanceError) {
    return NextResponse.json({ ok: false, error: scheduleError?.message || attendanceError?.message || 'Chargement impossible.' }, { status: 500 })
  }

  const schedule = findScheduleForDate((schedulesData || []) as unknown as StaffSchedule[], now)
  if (!schedule) {
    return NextResponse.json({ ok: false, error: 'Aucun horaire prévu aujourd’hui.' }, { status: 400 })
  }

  if (!attendanceData?.clock_in) {
    return NextResponse.json({ ok: false, error: 'Arrivée non pointée.' }, { status: 400 })
  }

  if (attendanceData.clock_out) {
    return NextResponse.json({ ok: false, error: 'Départ déjà pointé.' }, { status: 400 })
  }

  const clockInTime = extractTime(attendanceData.clock_in)
  const clockOutTime = extractTime(nowIso)
  const breakStartTime = attendanceData.break_start ? extractTime(attendanceData.break_start) : null
  const breakEndTime = attendanceData.break_end ? extractTime(attendanceData.break_end) : breakStartTime
  const breakMinutes = breakStartTime && breakEndTime ? Math.max(0, timeToMinutes(breakEndTime) - timeToMinutes(breakStartTime)) : 0
  const totalPresentMinutes = Math.max(0, timeToMinutes(clockOutTime) - timeToMinutes(clockInTime) - breakMinutes)
  const earlyLeaveMinutes = Math.max(0, timeToMinutes(schedule.expected_end) - timeToMinutes(clockOutTime))

  const { data: attendance, error } = await service
    .from('staff_attendance')
    .update({
      clock_out: nowIso,
      total_present_minutes: totalPresentMinutes,
      early_leave_minutes: earlyLeaveMinutes > 10 ? earlyLeaveMinutes : 0,
      status: 'completed',
    })
    .eq('id', attendanceData.id)
    .select('*')
    .single()

  if (error || !attendance) {
    return NextResponse.json({ ok: false, error: error?.message || 'Départ impossible.' }, { status: 500 })
  }

  await notifyEarlyLeave({
    schedule,
    attendance: attendance as StaffAttendance,
    staffName: profile.full_name || 'Réceptionniste',
  })

  return NextResponse.json({
    ok: true,
    message: 'Départ enregistré.',
    attendance,
  })
}
