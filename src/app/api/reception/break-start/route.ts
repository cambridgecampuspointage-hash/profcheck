import { NextResponse } from 'next/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'

function createServiceClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
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
    .select('id, role')
    .eq('id', user.id)
    .single()

  if (!profile || (profile.role !== 'reception' && profile.role !== 'admin')) {
    return NextResponse.json({ ok: false, error: 'Accès refusé' }, { status: 403 })
  }

  const service = createServiceClient()
  const today = new Date().toLocaleDateString('fr-CA', { timeZone: 'Africa/Casablanca' })
  const nowIso = new Date().toISOString()

  const { data: attendance, error: attendanceError } = await service
    .from('staff_attendance')
    .select('*')
    .eq('user_id', profile.id)
    .eq('date', today)
    .maybeSingle()

  if (attendanceError || !attendance?.clock_in) {
    return NextResponse.json({ ok: false, error: attendanceError?.message || 'Arrivée non pointée.' }, { status: 400 })
  }

  if (attendance.clock_out) {
    return NextResponse.json({ ok: false, error: 'La journée est déjà clôturée.' }, { status: 400 })
  }

  if (attendance.break_start && !attendance.break_end) {
    return NextResponse.json({ ok: false, error: 'Pause déjà en cours.' }, { status: 400 })
  }

  const { data, error } = await service
    .from('staff_attendance')
    .update({
      break_start: nowIso,
      break_end: null,
      status: 'on_break',
    })
    .eq('id', attendance.id)
    .select('*')
    .single()

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, message: 'Début de pause enregistré.', attendance: data })
}
