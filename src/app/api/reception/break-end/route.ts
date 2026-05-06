import { NextResponse } from 'next/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { findScheduleForDate } from '@/lib/reception/computeReceptionKpis'
import { notifyLongBreak } from '@/lib/reception/detectAnomalies'
import type { StaffAttendance, StaffSchedule } from '@/types/reception'

function createServiceClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
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
  const now = new Date()
  const today = now.toLocaleDateString('fr-CA', { timeZone: 'Africa/Casablanca' })
  const nowIso = now.toISOString()

  const [{ data: schedulesData, error: scheduleError }, { data: attendance, error: attendanceError }] = await Promise.all([
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

  if (!attendance?.break_start || attendance.break_end) {
    return NextResponse.json({ ok: false, error: 'Aucune pause en cours.' }, { status: 400 })
  }

  const schedule = findScheduleForDate((schedulesData || []) as unknown as StaffSchedule[], now)
  if (!schedule) {
    return NextResponse.json({ ok: false, error: 'Aucun horaire prévu aujourd’hui.' }, { status: 400 })
  }

  const breakStart = extractTime(attendance.break_start)
  const breakEnd = extractTime(nowIso)
  const breakDuration = Math.max(0, timeToMinutes(breakEnd) - timeToMinutes(breakStart))
  const breakOvertimeMinutes = Math.max(0, breakDuration - schedule.max_break_minutes)

  const { data, error } = await service
    .from('staff_attendance')
    .update({
      break_end: nowIso,
      break_overtime_minutes: breakOvertimeMinutes,
      status: 'present',
    })
    .eq('id', attendance.id)
    .select('*')
    .single()

  if (error || !data) {
    return NextResponse.json({ ok: false, error: error?.message || 'Fin de pause impossible.' }, { status: 500 })
  }

  await notifyLongBreak({
    schedule,
    attendance: data as StaffAttendance,
    staffName: profile.full_name || 'Réceptionniste',
    nowTime: breakEnd,
  })

  return NextResponse.json({
    ok: true,
    message: breakOvertimeMinutes > 0
      ? `Fin de pause enregistrée. Dépassement de ${breakOvertimeMinutes} min.`
      : 'Fin de pause enregistrée.',
    attendance: data,
  })
}
