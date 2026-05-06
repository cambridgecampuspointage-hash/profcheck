import { NextResponse } from 'next/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { findScheduleForDate } from '@/lib/reception/computeReceptionKpis'
import { notifyLateArrival } from '@/lib/reception/detectAnomalies'
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

export async function POST(request: Request) {
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
  const { today, nowIso } = getTodayInfo()
  const requestBody = await (async () => {
    try {
      return await request.json()
    } catch {
      return {}
    }
  })()
  const signatureDataUrl = typeof requestBody?.signatureDataUrl === 'string'
    ? requestBody.signatureDataUrl.trim()
    : ''
  const clientDate = typeof requestBody?.clientDate === 'string' ? requestBody.clientDate : ''
  const clientTime = typeof requestBody?.clientTime === 'string' ? requestBody.clientTime.slice(0, 5) : ''
  const { data: schedulesData, error: scheduleError } = await service
    .from('staff_schedules')
    .select('*, profile:profiles!staff_schedules_user_id_fkey(id, full_name, email, role)')
    .eq('user_id', profile.id)

  if (scheduleError) {
    return NextResponse.json({ ok: false, error: scheduleError.message }, { status: 500 })
  }

  const scheduleDate = clientDate
    ? (() => {
        const [year, month, day] = clientDate.split('-').map(Number)
        return new Date(year, (month || 1) - 1, day || 1)
      })()
    : new Date()
  const schedule = findScheduleForDate((schedulesData || []) as unknown as StaffSchedule[], scheduleDate)
  if (!schedule) {
    return NextResponse.json({ ok: false, error: 'Aucun horaire prévu aujourd’hui.' }, { status: 400 })
  }

  const { data: existing } = await service
    .from('staff_attendance')
    .select('*')
    .eq('user_id', profile.id)
    .eq('date', today)
    .maybeSingle()

  if (existing?.clock_in) {
    return NextResponse.json({ ok: false, error: 'Arrivée déjà pointée.' }, { status: 400 })
  }

  if (!signatureDataUrl) {
    return NextResponse.json({
      ok: false,
      error: 'La signature est obligatoire pour pointer l’arrivée.',
    }, { status: 400 })
  }

  const clockInTime = clientTime || extractTime(nowIso)
  const earliestClockInMinutes = timeToMinutes(schedule.expected_start) - 20
  const currentMinutes = timeToMinutes(clockInTime)

  if (currentMinutes < earliestClockInMinutes) {
    const earliestHours = Math.floor(earliestClockInMinutes / 60)
    const earliestMinutes = earliestClockInMinutes % 60
    const earliestLabel = `${String(earliestHours).padStart(2, '0')}:${String(earliestMinutes).padStart(2, '0')}`

    return NextResponse.json({
      ok: false,
      error: `Le pointage d’arrivée ouvre seulement 20 min avant l’horaire prévu, à partir de ${earliestLabel}.`,
    }, { status: 400 })
  }

  const lateMinutes = Math.max(0, (((Number(clockInTime.slice(0, 2)) * 60) + Number(clockInTime.slice(3, 5))) - ((Number(schedule.expected_start.slice(0, 2)) * 60) + Number(schedule.expected_start.slice(3, 5)))))

  const attendancePayload = {
    user_id: profile.id,
    date: today,
    clock_in: nowIso,
    signature_data_url: signatureDataUrl,
    late_minutes: lateMinutes,
    status: lateMinutes > 0 ? 'late' : 'present',
  }

  const { data: attendance, error } = await service
    .from('staff_attendance')
    .upsert(attendancePayload, { onConflict: 'user_id,date' })
    .select('*')
    .single()

  if (error || !attendance) {
    return NextResponse.json({ ok: false, error: error?.message || 'Pointage impossible.' }, { status: 500 })
  }

  await notifyLateArrival({
    schedule,
    attendance: attendance as StaffAttendance,
    staffName: profile.full_name || 'Réceptionniste',
  })

  return NextResponse.json({
    ok: true,
    message: lateMinutes > 0 ? `Arrivée enregistrée avec ${lateMinutes} min de retard.` : 'Arrivée enregistrée.',
    attendance,
  })
}
