import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isStudentEffectivelyBlocked } from '@/lib/student-payments'

async function getTokenContext(token: string) {
  const admin = createAdminClient()
  const { data: tokenRow, error } = await admin
    .from('student_checkin_tokens')
    .select('id, class_id, planned_session_id, expires_at, is_active')
    .eq('token', token)
    .maybeSingle()

  if (error || !tokenRow) {
    return { error: 'Lien de check-in invalide.' }
  }

  if (!tokenRow.is_active || new Date(tokenRow.expires_at) < new Date()) {
    return { error: 'Ce lien de check-in a expiré.' }
  }

  const { data: studentClass } = await admin
    .from('student_classes')
    .select('id, name, center:centers(name)')
    .eq('id', tokenRow.class_id)
    .maybeSingle()

  if (!studentClass) {
    return { error: 'Classe introuvable.' }
  }

  return { admin, tokenRow, studentClass }
}

export async function GET(_request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const context = await getTokenContext(token)

  if ('error' in context) {
    return NextResponse.json({ ok: false, error: context.error }, { status: 404 })
  }

  const { admin, tokenRow, studentClass } = context
  const { data: memberships } = await admin
    .from('student_class_members')
    .select('student:students(id, full_name, access_status, payment_due_date, status)')
    .eq('class_id', tokenRow.class_id)

  const students = (memberships || [])
    .map((membership) => Array.isArray(membership.student) ? membership.student[0] : membership.student)
    .filter((student): student is { id: string; full_name: string; access_status: 'allowed' | 'blocked'; payment_due_date: string | null; status: 'active' | 'inactive' } => Boolean(student))
    .filter((student) => student.status === 'active')
    .map((student) => ({
      id: student.id,
      full_name: student.full_name,
      access_status: isStudentEffectivelyBlocked(student) ? 'blocked' as const : 'allowed' as const,
      payment_due_date: student.payment_due_date,
      status: student.status,
    }))
    .sort((a, b) => a.full_name.localeCompare(b.full_name, 'fr'))

  return NextResponse.json({
    ok: true,
    class: {
      id: studentClass.id,
      name: studentClass.name,
      center_name: (studentClass.center as { name?: string } | null)?.name || null,
    },
    students,
  })
}

export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const body = await request.json().catch(() => null)
  const studentId = typeof body?.studentId === 'string' ? body.studentId : ''
  const signatureDataUrl = typeof body?.signatureDataUrl === 'string' ? body.signatureDataUrl.trim() : ''

  if (!studentId || !signatureDataUrl) {
    return NextResponse.json({ ok: false, error: 'Nom et signature requis.' }, { status: 400 })
  }

  const context = await getTokenContext(token)
  if ('error' in context) {
    return NextResponse.json({ ok: false, error: context.error }, { status: 404 })
  }

  const { admin, tokenRow, studentClass } = context

  const { data: membership } = await admin
    .from('student_class_members')
    .select('id')
    .eq('class_id', tokenRow.class_id)
    .eq('student_id', studentId)
    .maybeSingle()

  if (!membership) {
    return NextResponse.json({ ok: false, error: 'Étudiant non lié à cette classe.' }, { status: 400 })
  }

  const { data: student } = await admin
    .from('students')
    .select('id, full_name, access_status, payment_due_date, status')
    .eq('id', studentId)
    .maybeSingle()

  if (!student || student.status !== 'active') {
    return NextResponse.json({ ok: false, error: 'Étudiant indisponible.' }, { status: 400 })
  }

  if (isStudentEffectivelyBlocked(student)) {
    return NextResponse.json(
      {
        ok: false,
        blocked: true,
        error: 'Merci de voir l’administration',
      },
      { status: 403 }
    )
  }

  const today = new Date()
  const attendanceDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`

  const { error } = await admin
    .from('student_attendance')
    .upsert({
      student_id: student.id,
      class_id: tokenRow.class_id,
      planned_session_id: tokenRow.planned_session_id,
      attendance_date: attendanceDate,
      status: 'present',
      marked_at: new Date().toISOString(),
      source: 'qr',
      signature_data_url: signatureDataUrl,
      notes: `Signature publique ${studentClass.name}`,
    }, {
      onConflict: 'student_id,class_id,attendance_date',
    })

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }

  return NextResponse.json({
    ok: true,
    message: `${student.full_name}, votre présence a été enregistrée.`,
  })
}
