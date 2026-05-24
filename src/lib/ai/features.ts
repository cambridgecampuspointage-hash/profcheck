import { createAdminClient } from '@/lib/supabase/admin'
import { getDateRanges } from '@/lib/utils'

export async function buildReceptionBriefingContext() {
  const admin = createAdminClient()
  const today = new Date()
  const dateKey = today.toISOString().slice(0, 10)
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().slice(0, 10)

  const [profilesRes, attendanceRes, scheduleRes, smartFollowupsRes] = await Promise.all([
    admin.from('profiles').select('id, full_name').eq('role', 'reception'),
    admin
      .from('staff_attendance')
      .select('user_id, status, late_minutes, early_leave_minutes, break_overtime_minutes, clock_in, clock_out')
      .eq('date', dateKey),
    admin
      .from('staff_schedules')
      .select('user_id, expected_start, expected_end, work_days')
      .eq('role', 'reception'),
    admin.from('crm_activities').select('activity_type, created_at').gte('created_at', new Date(today.getTime() - 24 * 60 * 60 * 1000).toISOString()),
  ])

  const profiles = profilesRes.data || []
  const attendance = attendanceRes.data || []
  const schedules = scheduleRes.data || []
  const smartFollowups = smartFollowupsRes.data || []

  const lateCount = attendance.filter((row) => (row.late_minutes || 0) > 0).length
  const missingClockOut = attendance.filter((row) => row.clock_in && !row.clock_out).length
  const overtimeBreaks = attendance.filter((row) => (row.break_overtime_minutes || 0) > 0).length
  const absentCount = Math.max(0, profiles.length - attendance.length)
  const crmRelances = smartFollowups.filter((row) => row.activity_type === 'follow_up_reminder').length

  return [
    `Date: ${dateKey}`,
    `Réceptionnistes actives: ${profiles.length}`,
    `Pointages du jour: ${attendance.length}`,
    `Absences estimées: ${absentCount}`,
    `Retards du jour: ${lateCount}`,
    `Sorties manquantes: ${missingClockOut}`,
    `Pauses longues: ${overtimeBreaks}`,
    `Créneaux planifiés: ${schedules.length}`,
    `Relances CRM créées sur 24h: ${crmRelances}`,
    `Début du mois pour analyse RH: ${monthStart}`,
  ].join('\n')
}

export async function buildTeacherNotesContext(userId: string) {
  const admin = createAdminClient()
  const { data: teacher } = await admin
    .from('teachers')
    .select('id, full_name')
    .eq('user_id', userId)
    .maybeSingle()

  if (!teacher) {
    throw new Error('Professeur introuvable.')
  }

  const { data: sessions } = await admin
    .from('attendance_sessions')
    .select('started_at, ended_at, duration_minutes, teacher_notes, room:rooms(name)')
    .eq('teacher_id', teacher.id)
    .not('teacher_notes', 'is', null)
    .order('started_at', { ascending: false })
    .limit(15)

  const rows = (sessions || [])
    .filter((row) => typeof row.teacher_notes === 'string' && row.teacher_notes.trim().length > 0)
    .map((row, index) => {
      const roomName = (row.room as { name?: string } | null)?.name || 'Salle inconnue'
      return [
        `Séance ${index + 1}`,
        `Date: ${row.started_at}`,
        `Salle: ${roomName}`,
        `Durée: ${row.duration_minutes || 0} min`,
        `Note: ${row.teacher_notes}`,
      ].join('\n')
    })

  return [
    `Professeur: ${teacher.full_name}`,
    `Nombre de notes analysées: ${rows.length}`,
    '',
    rows.join('\n\n---\n\n'),
  ].join('\n')
}

export async function buildAlertsSummaryContext() {
  const admin = createAdminClient()
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
  const { data: alerts } = await admin
    .from('telegram_alerts_log')
    .select('alert_type, sent_ok, sent_at, error_message')
    .gte('sent_at', since)
    .order('sent_at', { ascending: false })
    .limit(40)

  const rows = (alerts || []).map((row, index) => {
    return [
      `Alerte ${index + 1}`,
      `Type: ${row.alert_type}`,
      `Envoyée: ${row.sent_ok ? 'oui' : 'non'}`,
      `Date: ${row.sent_at}`,
      `Erreur: ${row.error_message || 'aucune'}`,
    ].join('\n')
  })

  return [
    `Fenêtre analysée: 7 jours`,
    `Nombre d’alertes: ${rows.length}`,
    '',
    rows.join('\n\n---\n\n'),
  ].join('\n')
}

export async function buildDashboardAnomaliesContext() {
  const admin = createAdminClient()
  const now = new Date()
  const todayKey = now.toISOString().slice(0, 10)
  const { startOfWeek, startOfMonth } = getDateRanges()

  const [plannedRes, attendanceRes, correctionsRes, paymentRes, hotLeadsRes, followupsRes] = await Promise.all([
    admin.from('planned_sessions').select('id, status').eq('scheduled_date', todayKey),
    admin.from('attendance_sessions').select('id, status, started_at, ended_at').gte('created_at', `${todayKey}T00:00:00.000Z`).lt('created_at', `${todayKey}T23:59:59.999Z`),
    admin.from('attendance_correction_requests').select('id, status').eq('status', 'pending'),
    admin.from('crm_payment_followups').select('id, status').in('status', ['overdue', 'blocked', 'promised']),
    admin.from('crm_lead_scores').select('lead_id, temperature').eq('temperature', 'hot'),
    admin.from('crm_tasks').select('id, status, due_at').eq('status', 'pending'),
  ])

  const overdueTasks = (followupsRes.data || []).filter((row) => new Date(row.due_at).getTime() < now.getTime()).length
  const completedToday = (attendanceRes.data || []).filter((row) => row.status === 'completed').length
  const activeToday = (attendanceRes.data || []).filter((row) => row.status === 'active').length

  return [
    `Date: ${todayKey}`,
    `Planned sessions today: ${(plannedRes.data || []).length}`,
    `Completed attendance sessions today: ${completedToday}`,
    `Active attendance sessions today: ${activeToday}`,
    `Pending correction requests: ${(correctionsRes.data || []).length}`,
    `CRM hot leads: ${(hotLeadsRes.data || []).length}`,
    `Overdue CRM tasks: ${overdueTasks}`,
    `Payment follow-up cases: ${(paymentRes.data || []).length}`,
    `Week start: ${startOfWeek}`,
    `Month start: ${startOfMonth}`,
  ].join('\n')
}

export async function buildAdminChatContext(mode: string) {
  const admin = createAdminClient()
  const [hotLeadsRes, overdueRes, correctionsRes] = await Promise.all([
    admin.from('crm_lead_scores').select('lead_id', { count: 'exact', head: true }).eq('temperature', 'hot'),
    admin.from('crm_tasks').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
    admin.from('attendance_correction_requests').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
  ])

  return [
    `Mode: ${mode}`,
    `Hot leads CRM: ${hotLeadsRes.count || 0}`,
    `Tâches CRM en attente: ${overdueRes.count || 0}`,
    `Demandes de correction en attente: ${correctionsRes.count || 0}`,
  ].join('\n')
}
