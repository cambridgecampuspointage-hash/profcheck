import { NextResponse } from 'next/server'
import {
  autoCloseForgottenAttendanceSessions,
  checkCrmAlerts,
  checkOutOfPlanningAlerts,
  checkStaffAlerts,
  checkTeacherAlerts,
  getAlertsSupabaseClient,
} from '@/lib/telegram/checkAlerts'

export const dynamic = 'force-dynamic'

function getMoroccoNow() {
  const now = new Date()
  const today = now.toLocaleDateString('fr-CA', {
    timeZone: 'Africa/Casablanca',
  })
  const nowTime = now.toLocaleTimeString('fr-FR', {
    timeZone: 'Africa/Casablanca',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })

  return { today, nowTime }
}

function isAuthorized(request: Request) {
  const header = request.headers.get('authorization')
  const expected = process.env.CRON_SECRET
  return Boolean(expected && header === `Bearer ${expected}`)
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ ok: false, error: 'Non autorisé' }, { status: 401 })
  }

  try {
    const supabase = getAlertsSupabaseClient()
    const { today, nowTime } = getMoroccoNow()

    const [teacherAlerts, outOfPlanningAlerts, staffAlerts, crmAlerts, autoClosedSessions] = await Promise.all([
      checkTeacherAlerts(supabase, today, nowTime),
      checkOutOfPlanningAlerts(supabase, today),
      checkStaffAlerts(supabase, today, nowTime),
      checkCrmAlerts(supabase, today),
      autoCloseForgottenAttendanceSessions(supabase),
    ])

    return NextResponse.json({
      ok: true,
      checked_at: new Date().toISOString(),
      alerts_sent: teacherAlerts + outOfPlanningAlerts + staffAlerts + crmAlerts,
      details: {
        teacher_alerts: teacherAlerts,
        out_of_planning: outOfPlanningAlerts,
        staff_alerts: staffAlerts,
        crm_alerts: crmAlerts,
        auto_closed_sessions: autoClosedSessions,
      },
    })
  } catch (error) {
    console.error('[telegram] /api/alerts/check:', error)
    return NextResponse.json(
      { ok: false, error: 'Erreur interne lors de la vérification des alertes' },
      { status: 500 },
    )
  }
}
