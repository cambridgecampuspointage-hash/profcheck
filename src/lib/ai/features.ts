import { createAdminClient } from '@/lib/supabase/admin'
import { getDateRanges } from '@/lib/utils'

export type AiFeatureContext = {
  context: string
  shouldGenerate: boolean
  emptyMessage: string
}

function pickSingle<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) {
    return value[0] ?? null
  }

  return value ?? null
}

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
  const shouldGenerate =
    schedules.length > 0 ||
    attendance.length > 0 ||
    lateCount > 0 ||
    missingClockOut > 0 ||
    overtimeBreaks > 0 ||
    absentCount > 0 ||
    crmRelances > 0

  return {
    context: [
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
    ].join('\n'),
    shouldGenerate,
    emptyMessage: 'Aucun briefing utile pour aujourd’hui. Pas de planning réception ni d’écart opérationnel détecté.',
  } satisfies AiFeatureContext
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

  return {
    context: [
      `Fenêtre analysée: 7 jours`,
      `Nombre d’alertes: ${rows.length}`,
      '',
      rows.join('\n\n---\n\n'),
    ].join('\n'),
    shouldGenerate: rows.length > 0,
    emptyMessage: 'Aucune alerte Telegram récente à analyser sur les 7 derniers jours.',
  } satisfies AiFeatureContext
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
  const plannedToday = (plannedRes.data || []).length
  const pendingCorrections = (correctionsRes.data || []).length
  const hotLeads = (hotLeadsRes.data || []).length
  const paymentCases = (paymentRes.data || []).length
  const shouldGenerate =
    plannedToday > 0 ||
    completedToday > 0 ||
    activeToday > 0 ||
    pendingCorrections > 0 ||
    hotLeads > 0 ||
    overdueTasks > 0 ||
    paymentCases > 0

  return {
    context: [
      `Date: ${todayKey}`,
      `Planned sessions today: ${plannedToday}`,
      `Completed attendance sessions today: ${completedToday}`,
      `Active attendance sessions today: ${activeToday}`,
      `Pending correction requests: ${pendingCorrections}`,
      `CRM hot leads: ${hotLeads}`,
      `Overdue CRM tasks: ${overdueTasks}`,
      `Payment follow-up cases: ${paymentCases}`,
      `Week start: ${startOfWeek}`,
      `Month start: ${startOfMonth}`,
    ].join('\n'),
    shouldGenerate,
    emptyMessage: 'Aucune analyse utile pour aujourd’hui. Aucun planning, écart critique CRM ou cas de recouvrement détecté.',
  } satisfies AiFeatureContext
}

export async function buildAdminChatContext(mode: string) {
  const admin = createAdminClient()
  const now = new Date()
  const todayKey = now.toISOString().slice(0, 10)
  const startOfToday = `${todayKey}T00:00:00.000Z`
  const endOfToday = `${todayKey}T23:59:59.999Z`
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()

  const [
    hotLeadsRes,
    overdueTasksRes,
    correctionsRes,
    plannedRes,
    attendanceRes,
    paymentFollowupsRes,
    recentPaymentsRes,
    alertsRes,
    receptionAttendanceRes,
  ] = await Promise.all([
    admin
      .from('crm_lead_scores')
      .select('lead_id, score, temperature, lead:crm_leads(student_name, parent_name, status, next_follow_up_at, program_interest, placement_test_level)')
      .eq('temperature', 'hot')
      .order('score', { ascending: false })
      .limit(5),
    admin
      .from('crm_tasks')
      .select('id, title, due_at, status, lead:crm_leads(student_name, parent_name, status)')
      .eq('status', 'pending')
      .order('due_at', { ascending: true })
      .limit(5),
    admin
      .from('attendance_correction_requests')
      .select('id, status, created_at, reason, teacher:teachers(full_name)')
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .limit(5),
    admin
      .from('planned_sessions')
      .select('id, status, start_time, teacher:teachers(full_name), room:rooms(name)')
      .eq('scheduled_date', todayKey)
      .order('start_time', { ascending: true })
      .limit(8),
    admin
      .from('attendance_sessions')
      .select('id, status, started_at, ended_at, teacher:teachers(full_name), room:rooms(name)')
      .gte('created_at', startOfToday)
      .lt('created_at', endOfToday)
      .order('started_at', { ascending: false })
      .limit(8),
    admin
      .from('crm_payment_followups')
      .select('id, status, amount_due, promised_payment_date, student:students(full_name, parent_name), lead:crm_leads(student_name, parent_name)')
      .in('status', ['overdue', 'blocked', 'promised'])
      .order('updated_at', { ascending: false })
      .limit(5),
    admin
      .from('student_payment_records')
      .select('id, amount, paid_at, next_due_date, student:students(full_name, parent_name)')
      .order('paid_at', { ascending: false })
      .limit(5),
    admin
      .from('telegram_alerts_log')
      .select('alert_type, sent_ok, sent_at, error_message')
      .gte('sent_at', weekAgo)
      .order('sent_at', { ascending: false })
      .limit(5),
    admin
      .from('staff_attendance')
      .select('user_id, status, late_minutes, clock_in, clock_out')
      .eq('date', todayKey),
  ])

  const plannedRows = plannedRes.data || []
  const attendanceRows = attendanceRes.data || []
  const hotLeads = (hotLeadsRes.data || []).map((row, index) => {
    const lead = pickSingle(row.lead) as {
      student_name?: string | null
      parent_name?: string | null
      status?: string | null
      next_follow_up_at?: string | null
      program_interest?: string | null
      placement_test_level?: string | null
    } | null

    return [
      `Lead ${index + 1}: ${lead?.student_name || 'Prospect inconnu'}`,
      `Parent: ${lead?.parent_name || 'n/a'}`,
      `Score: ${row.score ?? 'n/a'} / ${row.temperature}`,
      `Statut: ${lead?.status || 'n/a'}`,
      `Programme: ${lead?.program_interest || 'n/a'}`,
      `Niveau test: ${lead?.placement_test_level || 'n/a'}`,
      `Relance: ${lead?.next_follow_up_at || 'non planifiée'}`,
    ].join(' | ')
  })

  const overdueTasks = (overdueTasksRes.data || []).map((row, index) => {
    const lead = pickSingle(row.lead) as {
      student_name?: string | null
      parent_name?: string | null
      status?: string | null
    } | null

    return `Tâche ${index + 1}: ${row.title} | Prospect: ${lead?.student_name || 'n/a'} | Parent: ${lead?.parent_name || 'n/a'} | Échéance: ${row.due_at}`
  })

  const corrections = (correctionsRes.data || []).map((row, index) => {
    const teacher = pickSingle(row.teacher) as { full_name?: string | null } | null
    return `Correction ${index + 1}: ${teacher?.full_name || 'Prof inconnu'} | Créée: ${row.created_at} | Motif: ${row.reason || 'n/a'}`
  })

  const plannedPreview = plannedRows.map((row, index) => {
    const teacher = pickSingle(row.teacher) as { full_name?: string | null } | null
    const room = pickSingle(row.room) as { name?: string | null } | null
    return `Séance ${index + 1}: ${row.start_time || 'heure n/a'} | ${teacher?.full_name || 'Prof inconnu'} | ${room?.name || 'Salle inconnue'} | ${row.status}`
  })

  const attendancePreview = attendanceRows.map((row, index) => {
    const teacher = pickSingle(row.teacher) as { full_name?: string | null } | null
    const room = pickSingle(row.room) as { name?: string | null } | null
    return `Pointage ${index + 1}: ${teacher?.full_name || 'Prof inconnu'} | ${room?.name || 'Salle inconnue'} | ${row.status} | Début: ${row.started_at || 'n/a'}`
  })

  const paymentFollowups = (paymentFollowupsRes.data || []).map((row, index) => {
    const student = pickSingle(row.student) as { full_name?: string | null; parent_name?: string | null } | null
    const lead = pickSingle(row.lead) as { student_name?: string | null; parent_name?: string | null } | null
    return `Recouvrement ${index + 1}: ${student?.full_name || lead?.student_name || 'Élève inconnu'} | Parent: ${student?.parent_name || lead?.parent_name || 'n/a'} | Statut: ${row.status} | Montant: ${row.amount_due ?? 'n/a'} | Promesse: ${row.promised_payment_date || 'aucune'}`
  })

  const recentPayments = (recentPaymentsRes.data || []).map((row, index) => {
    const student = pickSingle(row.student) as { full_name?: string | null; parent_name?: string | null } | null
    return `Paiement ${index + 1}: ${student?.full_name || 'Élève inconnu'} | Parent: ${student?.parent_name || 'n/a'} | Montant: ${row.amount ?? 'n/a'} | Payé le: ${row.paid_at} | Prochaine échéance: ${row.next_due_date}`
  })

  const recentAlerts = (alertsRes.data || []).map((row, index) => {
    return `Alerte ${index + 1}: ${row.alert_type} | ${row.sent_ok ? 'envoyée' : 'erreur'} | ${row.sent_at} | ${row.error_message || 'aucune erreur'}`
  })

  const receptionRows = receptionAttendanceRes.data || []
  const receptionLate = receptionRows.filter((row) => (row.late_minutes || 0) > 0).length
  const receptionMissingClockOut = receptionRows.filter((row) => row.clock_in && !row.clock_out).length

  return [
    `Mode demandé: ${mode}`,
    `Date: ${todayKey}`,
    '',
    'KPI globaux',
    `- Leads chauds CRM: ${hotLeads.length}`,
    `- Tâches CRM en attente visibles: ${overdueTasks.length}`,
    `- Corrections de pointage en attente: ${corrections.length}`,
    `- Séances planifiées aujourd’hui: ${plannedRows.length}`,
    `- Pointages prof aujourd’hui: ${attendanceRows.length}`,
    `- Dossiers recouvrement actifs: ${paymentFollowups.length}`,
    `- Paiements récents visibles: ${recentPayments.length}`,
    `- Alertes Telegram récentes visibles: ${recentAlerts.length}`,
    `- Pointages réception du jour: ${receptionRows.length}`,
    `- Réception en retard: ${receptionLate}`,
    `- Réception sorties manquantes: ${receptionMissingClockOut}`,
    '',
    'Top leads chauds',
    hotLeads.join('\n') || 'Aucun lead chaud visible.',
    '',
    'Tâches CRM prioritaires',
    overdueTasks.join('\n') || 'Aucune tâche CRM en attente.',
    '',
    'Corrections de pointage',
    corrections.join('\n') || 'Aucune correction en attente.',
    '',
    'Planning du jour',
    plannedPreview.join('\n') || 'Aucune séance planifiée aujourd’hui.',
    '',
    'Pointages prof du jour',
    attendancePreview.join('\n') || 'Aucun pointage prof visible aujourd’hui.',
    '',
    'Recouvrement et paiements',
    paymentFollowups.join('\n') || 'Aucun dossier recouvrement actif.',
    recentPayments.join('\n') || 'Aucun paiement récent visible.',
    '',
    'Alertes système récentes',
    recentAlerts.join('\n') || 'Aucune alerte récente.',
  ].join('\n')
}
