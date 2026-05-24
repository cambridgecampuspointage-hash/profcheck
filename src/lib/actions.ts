'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { logCrmActivity } from '@/lib/crm/activity'
import { matchAttendanceToPlanning } from '@/lib/planning/matchSessionToPlanning'
import { createClient } from '@/lib/supabase/server'
import { calculateDistanceMeters } from '@/lib/gps'
import { endOfDateFilterExclusive, getDateRanges, startOfDateFilter } from '@/lib/utils'
import crypto from 'crypto'
import type {
  ScanResponse,
  TeacherStats,
  AdminStats,
  TeacherReport,
  AttendanceSession,
  AttendanceCorrectionRequest,
  CrmActivity,
  CrmActivityType,
  CrmDashboardStats,
  CrmLead,
  CrmLeadStatus,
  CrmLeadTemperature,
  CrmMessageTemplate,
  CrmNote,
  CrmPaymentFollowup,
  CrmPaymentFollowupStatus,
  CrmScoredLead,
  CrmSourceStat,
  CrmTask,
  CrmTaskStatus,
  CrmTaskType,
  CrmAnalyticsSummary,
  CrmRecommendedClassMatch,
  CrmSmartFollowup,
  Profile,
  ReceptionUser,
  Student,
  StudentAttendance,
  StudentCheckinToken,
  StudentClass,
  StudentPaymentRecord,
  TeacherBadge,
  TeacherBadgeSummary,
} from '@/lib/types'
import type { PlannedSession } from '@/types/planning'
import type { TeacherReportData } from '@/lib/pdf/generateTeacherReport'

const DEMO_MODE_ENABLED = process.env.NEXT_PUBLIC_ENABLE_DEMO_LOGIN === 'true'

type TeacherBadgeMetrics = {
  completedSessions: number
  monthMinutes: number
  weekCompletedSessions: number
  rejectedAttemptsLast30Days: number
  correctionRequestsLast30Days: number
}

type TeacherRateSource = {
  hourly_rate?: number | null
  hourly_rate_short?: number | null
  hourly_rate_long?: number | null
}

function getAppliedHourlyRate(teacher: TeacherRateSource, plannedDurationMinutes: number) {
  const shortRate = Number(teacher.hourly_rate_short ?? teacher.hourly_rate ?? 0)
  const longRate = Number(teacher.hourly_rate_long ?? teacher.hourly_rate ?? 0)

  if ([60, 120].includes(plannedDurationMinutes)) {
    return Math.round(shortRate * 100) / 100
  }

  if ([90, 180].includes(plannedDurationMinutes)) {
    return Math.round(longRate * 100) / 100
  }

  return Math.round(Number(teacher.hourly_rate ?? shortRate) * 100) / 100
}

function getPayableMinutes(session: {
  planned_duration_minutes?: number | null
  duration_minutes?: number | null
}) {
  return session.planned_duration_minutes || session.duration_minutes || 0
}

function roundPayableAmount(value: number) {
  const rounded = Math.round(value * 100) / 100
  const nearestWhole = Math.round(rounded)

  if (Math.abs(rounded - nearestWhole) <= 0.02) {
    return nearestWhole
  }

  return rounded
}

function getPayableAmount(session: {
  payable_amount?: number | null
  planned_duration_minutes?: number | null
  duration_minutes?: number | null
  applied_hourly_rate?: number | null
}) {
  if (typeof session.payable_amount === 'number' && session.payable_amount > 0) {
    return session.payable_amount
  }

  const payableMinutes = getPayableMinutes(session)
  const hourlyRate = session.applied_hourly_rate || 0
  return roundPayableAmount((payableMinutes / 60) * hourlyRate)
}

function generateAccessCode(token: string): string {
  const hash = crypto.createHash('sha256').update(token).digest()
  const numeric = hash.readUInt32BE(0) % 1000000
  return numeric.toString().padStart(6, '0')
}

function formatDateKey(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function getLocalWeekStart(date = new Date()) {
  const copy = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  const day = copy.getDay()
  const diff = day === 0 ? -6 : 1 - day
  copy.setDate(copy.getDate() + diff)
  copy.setHours(0, 0, 0, 0)
  return copy
}

function buildTeacherBadges(metrics: TeacherBadgeMetrics): TeacherBadge[] {
  const badges: TeacherBadge[] = []

  if (metrics.completedSessions >= 1) {
    badges.push({
      id: 'premier-elan',
      name: 'Premier Elan',
      description: 'Premiere session validee avec succes.',
      tone: 'navy',
    })
  }

  if (metrics.completedSessions >= 10) {
    badges.push({
      id: 'aiguille-dor',
      name: "Aiguille d'Or",
      description: 'Dix sessions terminees avec un rythme solide.',
      tone: 'gold',
    })
  }

  if (metrics.weekCompletedSessions >= 3) {
    badges.push({
      id: 'cap-constant',
      name: 'Cap Constant',
      description: 'Presence reguliere sur la semaine en cours.',
      tone: 'emerald',
    })
  }

  if (metrics.monthMinutes >= 20 * 60) {
    badges.push({
      id: 'presence-signature',
      name: 'Presence Signature',
      description: 'Vingt heures ou plus validees ce mois-ci.',
      tone: 'rose',
    })
  }

  if (metrics.monthMinutes >= 40 * 60) {
    badges.push({
      id: 'pilier-de-salle',
      name: 'Pilier de Salle',
      description: 'Quarante heures ou plus validees ce mois-ci.',
      tone: 'gold',
    })
  }

  if (metrics.rejectedAttemptsLast30Days === 0 && metrics.completedSessions >= 5) {
    badges.push({
      id: 'main-sure',
      name: 'Main Sure',
      description: 'Aucun rejet recent sur les scans de pointage.',
      tone: 'emerald',
    })
  }

  if (
    metrics.completedSessions >= 20 &&
    metrics.rejectedAttemptsLast30Days === 0 &&
    metrics.correctionRequestsLast30Days === 0
  ) {
    badges.push({
      id: 'craie-dhonneur',
      name: "Craie d'Honneur",
      description: 'Parcours exemplaire sans incident recent.',
      tone: 'navy',
    })
  }

  return badges
}

async function getTeacherBadgeMetrics(teacherId: string) {
  const admin = createAdminClient()
  const { startOfWeek, startOfMonth } = getDateRanges()
  const last30Days = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

  const [completedSessionsRes, monthSessionsRes, weekSessionsRes, rejectedAttemptsRes, correctionRequestsRes] = await Promise.all([
    admin
      .from('attendance_sessions')
      .select('id', { count: 'exact', head: true })
      .eq('teacher_id', teacherId)
      .eq('status', 'completed'),
    admin
      .from('attendance_sessions')
      .select('duration_minutes, planned_duration_minutes')
      .eq('teacher_id', teacherId)
      .eq('status', 'completed')
      .gte('started_at', startOfMonth),
    admin
      .from('attendance_sessions')
      .select('id', { count: 'exact', head: true })
      .eq('teacher_id', teacherId)
      .eq('status', 'completed')
      .gte('started_at', startOfWeek),
    admin
      .from('attendance_attempts')
      .select('id', { count: 'exact', head: true })
      .eq('teacher_id', teacherId)
      .eq('status', 'rejected')
      .gte('created_at', last30Days),
    admin
      .from('attendance_correction_requests')
      .select('id', { count: 'exact', head: true })
      .eq('teacher_id', teacherId)
      .gte('created_at', last30Days),
  ])

  const monthMinutes = (monthSessionsRes.data || []).reduce((sum, session) => sum + getPayableMinutes(session), 0)

  return {
    completedSessions: completedSessionsRes.count || 0,
    monthMinutes,
    weekCompletedSessions: weekSessionsRes.count || 0,
    rejectedAttemptsLast30Days: rejectedAttemptsRes.count || 0,
    correctionRequestsLast30Days: correctionRequestsRes.count || 0,
  }
}

async function getSessionContext() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { supabase, user: null, role: null as string | null }
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  return { supabase, user, role: profile?.role ?? null }
}

async function isDemoSessionEnabled() {
  if (!DEMO_MODE_ENABLED) return false
  const { cookies } = await import('next/headers')
  return (await cookies()).get('demo-session')?.value === 'true'
}

// ─── QR TOKEN GENERATION ─────────────────────────────────────────────────────

export async function generateQrToken(roomId: string) {
  const isDemo = await isDemoSessionEnabled()

  if (isDemo) {
    const token = 'demo-token-' + Math.random().toString(36).substring(7)
    return {
      data: {
        token,
        center_id: 'demo-center-id',
        room_id: roomId,
        expires_at: new Date(Date.now() + 60000).toISOString(),
        access_code: generateAccessCode(token),
        gps_verification_enabled: true,
      },
    }
  }

  const { user, role } = await getSessionContext()
  if (!user) return { error: 'Non authentifié' }
  if (role !== 'admin' && role !== 'reception') return { error: 'Accès refusé' }

  const admin = createAdminClient()

  // Get room and center info
  const { data: room } = await admin
    .from('rooms')
    .select('*, center:centers(*)')
    .eq('id', roomId)
    .single()

  if (!room) return { error: 'Salle non trouvée' }

  // Deactivate old tokens for this room
  await admin
    .from('qr_tokens')
    .update({ is_active: false })
    .eq('room_id', roomId)

  // Generate new token
  const token = crypto.randomBytes(32).toString('hex')
  const expiresAt = new Date(Date.now() + 60 * 1000).toISOString() // 60 seconds

  const { data: qrToken, error } = await admin
    .from('qr_tokens')
    .insert({
      center_id: room.center_id,
      room_id: roomId,
      token,
      expires_at: expiresAt,
      is_active: true,
    })
    .select()
    .single()

  if (error) return { error: 'Erreur de génération du QR code' }

  return {
    data: {
      token: qrToken.token,
      center_id: qrToken.center_id,
      room_id: qrToken.room_id,
      expires_at: qrToken.expires_at,
      access_code: generateAccessCode(qrToken.token),
      gps_verification_enabled: room.center?.gps_verification_enabled !== false,
    },
  }
}

export async function resolveAttendanceCode(code: string) {
  const normalizedCode = code.trim()
  if (!/^\d{6}$/.test(normalizedCode)) {
    return { error: 'Le code doit contenir exactement 6 chiffres.' }
  }

  const { user } = await getSessionContext()
  if (!user) return { error: 'Non authentifié' }

  const admin = createAdminClient()
  const now = new Date().toISOString()

  const { data: activeTokens, error } = await admin
    .from('qr_tokens')
    .select('token, center_id, room_id, expires_at')
    .eq('is_active', true)
    .gt('expires_at', now)
    .order('created_at', { ascending: false })
    .limit(100)

  if (error || !activeTokens?.length) {
    return { error: 'Aucun code actif trouvé.' }
  }

  const match = activeTokens.find((tokenRow) => generateAccessCode(tokenRow.token) === normalizedCode)
  if (!match) {
    return { error: 'Code invalide ou expiré.' }
  }

  const { data: center } = await admin
    .from('centers')
    .select('gps_verification_enabled')
    .eq('id', match.center_id)
    .maybeSingle()

  return {
    data: {
      token: match.token,
      center_id: match.center_id,
      room_id: match.room_id,
      expires_at: match.expires_at,
      access_code: normalizedCode,
      gps_verification_enabled: center?.gps_verification_enabled !== false,
    },
  }
}

// ─── VALIDATE ATTENDANCE SCAN ─────────────────────────────────────────────────

export async function validateAttendanceScan(
  token: string,
  centerId: string,
  roomId: string,
  action: 'start' | 'end',
  latitude: number,
  longitude: number,
  options?: {
    gpsAccuracyMeters?: number
    plannedDurationMinutes?: number
    sessionType?: 'standard' | 'one_to_one'
    signatureDataUrl?: string
    teacherNotes?: string
  }
): Promise<ScanResponse> {
  const supabase = await createClient()
  const admin = createAdminClient()

  // 1. Check authentication
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, message: 'Non authentifié. Veuillez vous reconnecter.' }

  // 2. Get teacher record
  const { data: teacher } = await admin
    .from('teachers')
    .select('*')
    .eq('user_id', user.id)
    .single()

  if (!teacher) return { success: false, message: 'Profil professeur non trouvé.' }
  if (teacher.status !== 'active') return { success: false, message: 'Votre compte est désactivé.' }

  // 3. Validate QR token
  const { data: qrToken } = await admin
    .from('qr_tokens')
    .select('*')
    .eq('token', token)
    .eq('center_id', centerId)
    .eq('room_id', roomId)
    .single()

  if (!qrToken) {
    await logAttempt(admin, teacher.id, centerId, roomId, token, action, latitude, longitude, 0, 'rejected', 'Token invalide')
    return { success: false, message: 'QR code invalide.' }
  }

  // 4. Check token expiry
  if (new Date(qrToken.expires_at) < new Date()) {
    await logAttempt(admin, teacher.id, centerId, roomId, token, action, latitude, longitude, 0, 'rejected', 'Token expiré')
    return { success: false, message: 'QR code expiré. Veuillez scanner le nouveau QR code.' }
  }

  if (!qrToken.is_active) {
    await logAttempt(admin, teacher.id, centerId, roomId, token, action, latitude, longitude, 0, 'rejected', 'Token inactif')
    return { success: false, message: 'QR code expiré. Veuillez scanner le nouveau QR code.' }
  }

  // 5. Check GPS distance
  const { data: center } = await admin
    .from('centers')
    .select('*')
    .eq('id', centerId)
    .single()

  if (!center) return { success: false, message: 'Centre non trouvé.' }

  const distance = calculateDistanceMeters(latitude, longitude, center.latitude, center.longitude)
  const gpsAccuracyMeters = Number.isFinite(options?.gpsAccuracyMeters)
    ? Math.max(0, Number(options?.gpsAccuracyMeters))
    : 0
  const gpsToleranceMeters = Math.min(gpsAccuracyMeters, 60)
  const fallbackToleranceMeters = gpsAccuracyMeters > 0 ? 0 : 25
  const effectiveRadiusMeters = center.allowed_radius_meters + gpsToleranceMeters + fallbackToleranceMeters

  if (center.gps_verification_enabled !== false && distance > effectiveRadiusMeters) {
    await logAttempt(
      admin,
      teacher.id,
      centerId,
      roomId,
      token,
      action,
      latitude,
      longitude,
      distance,
      'rejected',
      `Hors zone: ${Math.round(distance)}m (rayon ${center.allowed_radius_meters}m, marge GPS ${Math.round(gpsToleranceMeters + fallbackToleranceMeters)}m)`
    )
    return {
      success: false,
      message: `Pointage refusé : vous êtes hors zone du centre (${Math.round(distance)}m).`,
    }
  }

  // 6. Handle START action
  if (action === 'start') {
    const plannedDurationMinutes = options?.plannedDurationMinutes
    const sessionType = options?.sessionType || 'standard'
    const signatureDataUrl = options?.signatureDataUrl?.trim()
    const teacherNotes = options?.teacherNotes?.trim() || null
    const startedAt = new Date()

    if (![60, 90, 120, 180].includes(plannedDurationMinutes || 0)) {
      await logAttempt(admin, teacher.id, centerId, roomId, token, action, latitude, longitude, distance, 'rejected', 'Durée planifiée invalide')
      return { success: false, message: 'Veuillez choisir une durée planifiée valide.' }
    }

    if (!signatureDataUrl) {
      await logAttempt(admin, teacher.id, centerId, roomId, token, action, latitude, longitude, distance, 'rejected', 'Signature manquante')
      return { success: false, message: 'La signature est obligatoire pour démarrer le cours.' }
    }

    // Check for existing active session
    const { data: activeSession } = await admin
      .from('attendance_sessions')
      .select('*')
      .eq('teacher_id', teacher.id)
      .eq('status', 'active')
      .maybeSingle()

    if (activeSession) {
      await logAttempt(admin, teacher.id, centerId, roomId, token, action, latitude, longitude, distance, 'rejected', 'Session déjà active')
      return { success: false, message: 'Vous avez déjà une session en cours.' }
    }

    // Create new session
    const appliedHourlyRate = getAppliedHourlyRate(teacher, plannedDurationMinutes || 0)
    const payableAmount = roundPayableAmount(((plannedDurationMinutes || 0) / 60) * appliedHourlyRate)

    const planningMatch = await matchAttendanceToPlanning(teacher.id, startedAt, admin).catch(() => ({
      matched: false as const,
      plannedSession: null,
    }))

    const { data: session, error } = await admin
      .from('attendance_sessions')
      .insert({
        teacher_id: teacher.id,
        center_id: centerId,
        room_id: roomId,
        started_at: startedAt.toISOString(),
        start_latitude: latitude,
        start_longitude: longitude,
        start_status: 'accepted',
        planned_duration_minutes: plannedDurationMinutes,
        session_type: sessionType,
        applied_hourly_rate: appliedHourlyRate,
        payable_amount: payableAmount,
        signature_data_url: signatureDataUrl,
        teacher_notes: teacherNotes,
        status: 'active',
      })
      .select('*, room:rooms(*), center:centers(*)')
      .single()

    if (error) return { success: false, message: 'Erreur lors de la création de la session.' }

    if (planningMatch.matched) {
      await admin
        .from('planned_sessions')
        .update({
          linked_session_id: session.id,
          status: 'in_progress',
        })
        .eq('id', planningMatch.plannedSession.id)
    }

    await logAttempt(admin, teacher.id, centerId, roomId, token, action, latitude, longitude, distance, 'accepted', null)
    return { success: true, message: 'Cours commencé avec succès !', session }
  }

  // 7. Handle END action
  if (action === 'end') {
    const { data: activeSession } = await admin
      .from('attendance_sessions')
      .select('*')
      .eq('teacher_id', teacher.id)
      .eq('status', 'active')
      .maybeSingle()

    if (!activeSession) {
      await logAttempt(admin, teacher.id, centerId, roomId, token, action, latitude, longitude, distance, 'rejected', 'Aucune session active')
      return { success: false, message: 'Aucune session active à terminer.' }
    }

    const endedAt = new Date()
    const startedAt = new Date(activeSession.started_at)
    const durationMinutes = Math.round((endedAt.getTime() - startedAt.getTime()) / 60000)

    const { data: session, error } = await admin
      .from('attendance_sessions')
      .update({
        ended_at: endedAt.toISOString(),
        duration_minutes: durationMinutes,
        end_latitude: latitude,
        end_longitude: longitude,
        end_status: 'accepted',
        status: 'completed',
      })
      .eq('id', activeSession.id)
      .select('*, room:rooms(*), center:centers(*)')
      .single()

    if (error) return { success: false, message: 'Erreur lors de la fin de session.' }

    await admin
      .from('planned_sessions')
      .update({
        status: 'completed',
      })
      .eq('linked_session_id', activeSession.id)
      .in('status', ['scheduled', 'in_progress'])

    await logAttempt(admin, teacher.id, centerId, roomId, token, action, latitude, longitude, distance, 'accepted', null)
    return { success: true, message: 'Cours terminé avec succès !', session }
  }

  return { success: false, message: 'Action invalide.' }
}

// ─── TEACHER STATS ────────────────────────────────────────────────────────────

export async function getTeacherStats(): Promise<TeacherStats | null> {
  const isDemo = await isDemoSessionEnabled()

  if (isDemo) {
    return {
      todayHours: 3.5,
      weekHours: 18.5,
      monthHours: 72,
      activeSession: null,
    }
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const admin = createAdminClient()

  const { data: teacher } = await admin
    .from('teachers')
    .select('id')
    .eq('user_id', user.id)
    .single()

  if (!teacher) return null

  const { startOfDay, startOfWeek, startOfMonth } = getDateRanges()

  // Active session
  const { data: activeSession } = await admin
    .from('attendance_sessions')
    .select('*, room:rooms(*), center:centers(*)')
    .eq('teacher_id', teacher.id)
    .eq('status', 'active')
    .maybeSingle()

  // Today hours
  const { data: todaySessions } = await admin
    .from('attendance_sessions')
    .select('duration_minutes, planned_duration_minutes')
    .eq('teacher_id', teacher.id)
    .eq('status', 'completed')
    .gte('started_at', startOfDay)

  const todayMinutes = todaySessions?.reduce((sum, s) => sum + getPayableMinutes(s), 0) || 0

  // Week hours
  const { data: weekSessions } = await admin
    .from('attendance_sessions')
    .select('duration_minutes, planned_duration_minutes')
    .eq('teacher_id', teacher.id)
    .eq('status', 'completed')
    .gte('started_at', startOfWeek)

  const weekMinutes = weekSessions?.reduce((sum, s) => sum + getPayableMinutes(s), 0) || 0

  // Month hours
  const { data: monthSessions } = await admin
    .from('attendance_sessions')
    .select('duration_minutes, planned_duration_minutes')
    .eq('teacher_id', teacher.id)
    .eq('status', 'completed')
    .gte('started_at', startOfMonth)

  const monthMinutes = monthSessions?.reduce((sum, s) => sum + getPayableMinutes(s), 0) || 0

  return {
    todayHours: todayMinutes / 60,
    weekHours: weekMinutes / 60,
    monthHours: monthMinutes / 60,
    activeSession: activeSession as AttendanceSession | null,
  }
}

export async function getTeacherBadges(): Promise<TeacherBadge[]> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return []

  const admin = createAdminClient()
  const { data: teacher } = await admin
    .from('teachers')
    .select('id')
    .eq('user_id', user.id)
    .single()

  if (!teacher) return []

  const metrics = await getTeacherBadgeMetrics(teacher.id)
  return buildTeacherBadges(metrics)
}

// ─── TEACHER HISTORY ──────────────────────────────────────────────────────────

export async function getTeacherHistory() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const admin = createAdminClient()

  const { data: teacher } = await admin
    .from('teachers')
    .select('id')
    .eq('user_id', user.id)
    .single()

  if (!teacher) return []

  const { data } = await admin
    .from('attendance_sessions')
    .select('*, room:rooms(name), center:centers(name)')
    .eq('teacher_id', teacher.id)
    .order('started_at', { ascending: false })
    .limit(100)

  return data || []
}

export async function getTeacherPlannedSessions(): Promise<PlannedSession[]> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const admin = createAdminClient()

  const { data: teacher } = await admin
    .from('teachers')
    .select('id')
    .eq('user_id', user.id)
    .single()

  if (!teacher) return []

  const weekStart = getLocalWeekStart()
  const weekEnd = new Date(weekStart)
  weekEnd.setDate(weekStart.getDate() + 5)

  const { data, error } = await admin
    .from('planned_sessions')
    .select(`
      *,
      teacher:teachers(full_name),
      room:rooms(name),
      campus:centers(name),
      linked_session:attendance_sessions(started_at, ended_at, duration_minutes)
    `)
    .eq('teacher_id', teacher.id)
    .gte('scheduled_date', formatDateKey(weekStart))
    .lte('scheduled_date', formatDateKey(weekEnd))
    .order('scheduled_date')
    .order('start_time')

  if (error) return []

  return ((data || []).map((session) => ({
    ...session,
    linked_session: session.linked_session
      ? {
          start_time: (session.linked_session as { started_at?: string }).started_at || null,
          end_time: (session.linked_session as { ended_at?: string }).ended_at || null,
          duration_minutes: (session.linked_session as { duration_minutes?: number | null }).duration_minutes || null,
        }
      : null,
  })) as PlannedSession[])
}

export async function getTeacherActiveSessionRoster(): Promise<{
  activeSessionId: string
  plannedSessionId: string
  classId: string
  className: string
  students: Array<{
    id: string
    full_name: string
    status: 'active' | 'inactive'
    access_status: 'allowed' | 'blocked'
    attendance_status: 'present' | 'absent' | 'late' | 'excused' | null
    attendance_source: 'qr' | 'teacher' | 'admin' | 'reception' | null
  }>
} | null> {
  const { user, role } = await getSessionContext()
  if (!user || role !== 'teacher') return null

  const admin = createAdminClient()
  const { data: teacher } = await admin
    .from('teachers')
    .select('id')
    .eq('user_id', user.id)
    .single()

  if (!teacher) return null

  const { data: activeSession } = await admin
    .from('attendance_sessions')
    .select('id')
    .eq('teacher_id', teacher.id)
    .eq('status', 'active')
    .maybeSingle()

  if (!activeSession) return null

  const { data: plannedSession } = await admin
    .from('planned_sessions')
    .select('id, class_id, class:student_classes(id, name)')
    .eq('linked_session_id', activeSession.id)
    .maybeSingle()

  const classRow = Array.isArray(plannedSession?.class) ? plannedSession.class[0] : plannedSession?.class
  if (!plannedSession?.class_id || !classRow?.id) return null

  const attendanceDate = formatDateKey(new Date())
  const [membershipsRes, attendanceRes] = await Promise.all([
    admin
      .from('student_class_members')
      .select('student:students(id, full_name, status, access_status)')
      .eq('class_id', plannedSession.class_id),
    admin
      .from('student_attendance')
      .select('student_id, status, source')
      .eq('class_id', plannedSession.class_id)
      .eq('attendance_date', attendanceDate),
  ])

  if (membershipsRes.error || attendanceRes.error) return null

  const attendanceMap = new Map(
    (attendanceRes.data || []).map((row) => [
      row.student_id as string,
      {
        status: row.status as 'present' | 'absent' | 'late' | 'excused',
        source: row.source as 'qr' | 'teacher' | 'admin' | 'reception',
      },
    ]),
  )

  const students = (membershipsRes.data || [])
    .map((membership) => Array.isArray(membership.student) ? membership.student[0] : membership.student)
    .filter((student): student is { id: string; full_name: string; status: 'active' | 'inactive'; access_status: 'allowed' | 'blocked' } => Boolean(student))
    .sort((left, right) => left.full_name.localeCompare(right.full_name, 'fr'))
    .map((student) => {
      const attendance = attendanceMap.get(student.id)
      return {
        id: student.id,
        full_name: student.full_name,
        status: student.status,
        access_status: student.access_status,
        attendance_status: attendance?.status || null,
        attendance_source: attendance?.source || null,
      }
    })

  return {
    activeSessionId: activeSession.id,
    plannedSessionId: plannedSession.id,
    classId: plannedSession.class_id,
    className: classRow.name,
    students,
  }
}

export async function getMyTeacherReportData(dateFrom: string, dateTo: string): Promise<{ data?: TeacherReportData; error?: string }> {
  const { user, role } = await getSessionContext()
  if (!user || role !== 'teacher') return { error: 'Accès refusé' }

  const admin = createAdminClient()
  const { data: teacher } = await admin
    .from('teachers')
    .select('id, full_name, email, hourly_rate, hourly_rate_short, hourly_rate_long')
    .eq('user_id', user.id)
    .single()

  if (!teacher) return { error: 'Profil professeur introuvable.' }

  const { data: sessions, error } = await admin
    .from('attendance_sessions')
    .select('started_at, ended_at, duration_minutes, planned_duration_minutes, status, session_type, applied_hourly_rate, payable_amount, teacher_notes, room:rooms(name)')
    .eq('teacher_id', teacher.id)
    .eq('status', 'completed')
    .gte('started_at', startOfDateFilter(dateFrom))
    .lt('started_at', endOfDateFilterExclusive(dateTo))
    .order('started_at', { ascending: true })

  if (error) return { error: error.message }

  const safeSessions = (sessions || []).map((session) => {
    const startedAt = new Date(session.started_at)
    const endedAt = session.ended_at ? new Date(session.ended_at) : null
    const roomName = (session.room as { name?: string } | null)?.name

    return {
      date: session.started_at,
      start_time: Number.isNaN(startedAt.getTime()) ? '—' : startedAt.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
      end_time: !endedAt || Number.isNaN(endedAt.getTime()) ? '—' : endedAt.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
      duration_minutes: getPayableMinutes(session),
      room: roomName || undefined,
      subject: session.session_type === 'one_to_one' ? 'One-to-one' : 'Cours normal',
      note: typeof session.teacher_notes === 'string' ? session.teacher_notes : undefined,
      status: 'validé' as const,
    }
  })

  const totalMinutes = safeSessions.reduce((sum, session) => sum + session.duration_minutes, 0)
  const totalHours = totalMinutes / 60
  const estimatedPayment = (sessions || []).reduce((sum, session) => sum + getPayableAmount(session), 0)
  const hourlyRate = totalHours > 0 ? estimatedPayment / totalHours : teacher.hourly_rate || 0

  return {
    data: {
      teacher_name: teacher.full_name,
      teacher_email: teacher.email || undefined,
      teacher_id: teacher.id,
      period_from: dateFrom,
      period_to: dateTo,
      hourly_rate: Math.round(hourlyRate * 100) / 100,
      total_sessions: safeSessions.length,
      total_hours: Math.round(totalHours * 100) / 100,
      estimated_payment: Math.round(estimatedPayment * 100) / 100,
      sessions: safeSessions,
    },
  }
}

export async function getTeacherCorrectionRequests(): Promise<AttendanceCorrectionRequest[]> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return []

  const admin = createAdminClient()
  const { data: teacher } = await admin
    .from('teachers')
    .select('id')
    .eq('user_id', user.id)
    .single()

  if (!teacher) return []

  const { data } = await admin
    .from('attendance_correction_requests')
    .select('*, session:attendance_sessions(*, room:rooms(name), center:centers(name))')
    .eq('teacher_id', teacher.id)
    .order('created_at', { ascending: false })
    .limit(100)

  return (data || []) as AttendanceCorrectionRequest[]
}

export async function createCorrectionRequest(input: {
  session_id?: string
  request_type: 'missed_start' | 'missed_end' | 'gps_issue' | 'other'
  requested_start_at?: string
  requested_end_at?: string
  reason: string
}) {
  const { user, role } = await getSessionContext()
  if (!user || role !== 'teacher') return { error: 'Accès refusé' }

  const admin = createAdminClient()
  const { data: teacher } = await admin
    .from('teachers')
    .select('id')
    .eq('user_id', user.id)
    .single()

  if (!teacher) return { error: 'Profil professeur non trouvé' }

  if (input.session_id) {
    const { data: session } = await admin
      .from('attendance_sessions')
      .select('id')
      .eq('id', input.session_id)
      .eq('teacher_id', teacher.id)
      .maybeSingle()

    if (!session) return { error: 'Session introuvable pour cette demande' }
  }

  const { error } = await admin
    .from('attendance_correction_requests')
    .insert({
      teacher_id: teacher.id,
      session_id: input.session_id || null,
      request_type: input.request_type,
      requested_start_at: input.requested_start_at || null,
      requested_end_at: input.requested_end_at || null,
      reason: input.reason,
    })

  if (error) return { error: error.message }
  return { success: true }
}

// ─── ADMIN STATS ──────────────────────────────────────────────────────────────

export async function getAdminStats(): Promise<AdminStats | null> {
  const isDemo = await isDemoSessionEnabled()

  if (isDemo) {
    return {
      totalTeachers: 12,
      activeTeachersNow: 4,
      totalHoursToday: 24.5,
      totalHoursWeek: 168,
      totalHoursMonth: 720,
      recentAttendance: [],
      rejectedAttempts: [],
    }
  }

  const { user, role } = await getSessionContext()
  if (!user || role !== 'admin') return null

  const admin = createAdminClient()

  const { startOfDay, startOfWeek, startOfMonth } = getDateRanges()

  // Total teachers
  const { count: totalTeachers } = await admin
    .from('teachers')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'active')

  // Active sessions
  const { count: activeTeachersNow } = await admin
    .from('attendance_sessions')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'active')

  // Today hours
  const { data: todaySessions } = await admin
    .from('attendance_sessions')
    .select('duration_minutes, planned_duration_minutes')
    .eq('status', 'completed')
    .gte('started_at', startOfDay)

  const totalHoursToday = (todaySessions?.reduce((sum, s) => sum + getPayableMinutes(s), 0) || 0) / 60

  // Week hours
  const { data: weekSessions } = await admin
    .from('attendance_sessions')
    .select('duration_minutes, planned_duration_minutes')
    .eq('status', 'completed')
    .gte('started_at', startOfWeek)

  const totalHoursWeek = (weekSessions?.reduce((sum, s) => sum + getPayableMinutes(s), 0) || 0) / 60

  // Month hours
  const { data: monthSessions } = await admin
    .from('attendance_sessions')
    .select('duration_minutes, planned_duration_minutes')
    .eq('status', 'completed')
    .gte('started_at', startOfMonth)

  const totalHoursMonth = (monthSessions?.reduce((sum, s) => sum + getPayableMinutes(s), 0) || 0) / 60

  // Recent attendance
  const { data: recentAttendance } = await admin
    .from('attendance_sessions')
    .select('*, teacher:teachers(full_name), room:rooms(name)')
    .order('created_at', { ascending: false })
    .limit(10)

  // Rejected attempts
  const { data: rejectedAttempts } = await admin
    .from('attendance_attempts')
    .select('*, teacher:teachers(full_name), room:rooms(name)')
    .eq('status', 'rejected')
    .order('created_at', { ascending: false })
    .limit(10)

  return {
    totalTeachers: totalTeachers || 0,
    activeTeachersNow: activeTeachersNow || 0,
    totalHoursToday,
    totalHoursWeek,
    totalHoursMonth,
    recentAttendance: (recentAttendance || []) as AttendanceSession[],
    rejectedAttempts: rejectedAttempts || [],
  }
}

// ─── ADMIN - TEACHERS MANAGEMENT ──────────────────────────────────────────────

export async function getTeachers() {
  const { user, role } = await getSessionContext()
  if (!user || role !== 'admin') return []

  const admin = createAdminClient()
  const { data } = await admin
    .from('teachers')
    .select('*')
    .order('created_at', { ascending: false })
  return data || []
}

export async function getTeacherBadgeSummaries(): Promise<TeacherBadgeSummary[]> {
  const { user, role } = await getSessionContext()
  if (!user || role !== 'admin') return []

  const admin = createAdminClient()
  const { data: teachers } = await admin
    .from('teachers')
    .select('id')

  if (!teachers?.length) return []

  const summaries = await Promise.all(
    teachers.map(async (teacher) => ({
      teacher_id: teacher.id,
      badges: buildTeacherBadges(await getTeacherBadgeMetrics(teacher.id)),
    }))
  )

  return summaries
}

export async function createTeacher(formData: {
  full_name: string
  email: string
  phone?: string
  languages?: string[]
  hourly_rate?: number
  hourly_rate_short?: number
  hourly_rate_long?: number
}) {
  const { user, role } = await getSessionContext()
  if (!user || role !== 'admin') return { error: 'Accès refusé' }

  const admin = createAdminClient()

  // Create auth user with random password (teacher can reset)
  const tempPassword = crypto.randomBytes(16).toString('hex')
  const { data: authUser, error: authError } = await admin.auth.admin.createUser({
    email: formData.email,
    password: tempPassword,
    email_confirm: true,
    user_metadata: {
      full_name: formData.full_name,
      role: 'teacher',
    },
  })

  if (authError) return { error: authError.message }

  // Update teacher record that was auto-created by trigger
  const { error } = await admin
    .from('teachers')
    .update({
      full_name: formData.full_name,
      phone: formData.phone || null,
      languages: formData.languages || [],
      hourly_rate: formData.hourly_rate_short || formData.hourly_rate || 0,
      hourly_rate_short: formData.hourly_rate_short || formData.hourly_rate || 0,
      hourly_rate_long: formData.hourly_rate_long || formData.hourly_rate || 0,
    })
    .eq('user_id', authUser.user.id)

  if (error) return { error: error.message }

  return { success: true, tempPassword }
}

export async function updateTeacher(
  teacherId: string,
  data: Partial<{
    full_name: string
    phone: string
    languages: string[]
    hourly_rate: number
    hourly_rate_short: number
    hourly_rate_long: number
    status: string
  }>
) {
  const { user, role } = await getSessionContext()
  if (!user || role !== 'admin') return { error: 'Accès refusé' }

  const admin = createAdminClient()
  const payload = {
    ...data,
    hourly_rate: typeof data.hourly_rate_short === 'number'
      ? data.hourly_rate_short
      : data.hourly_rate,
  }

  const { error } = await admin
    .from('teachers')
    .update(payload)
    .eq('id', teacherId)

  if (error) return { error: error.message }
  return { success: true }
}

export async function resetTeacherPassword(teacherId: string) {
  const { user, role } = await getSessionContext()
  if (!user || role !== 'admin') return { error: 'Accès refusé' }

  const admin = createAdminClient()
  const { data: teacher, error: teacherError } = await admin
    .from('teachers')
    .select('id, full_name, user_id')
    .eq('id', teacherId)
    .single()

  if (teacherError || !teacher?.user_id) {
    return { error: 'Professeur introuvable' }
  }

  const tempPassword = crypto.randomBytes(16).toString('hex')
  const { error: resetError } = await admin.auth.admin.updateUserById(teacher.user_id, {
    password: tempPassword,
  })

  if (resetError) return { error: resetError.message }

  return {
    success: true,
    tempPassword,
    fullName: teacher.full_name,
  }
}

export async function deleteTeacher(teacherId: string) {
  const { user, role } = await getSessionContext()
  if (!user || role !== 'admin') return { error: 'Accès refusé' }

  const admin = createAdminClient()
  const { data: teacher, error: teacherError } = await admin
    .from('teachers')
    .select('id, user_id')
    .eq('id', teacherId)
    .single()

  if (teacherError || !teacher) {
    return { error: 'Professeur introuvable' }
  }

  const { error: deleteTeacherError } = await admin
    .from('teachers')
    .delete()
    .eq('id', teacherId)

  if (deleteTeacherError) return { error: deleteTeacherError.message }

  if (teacher.user_id) {
    const { error: deleteAuthError } = await admin.auth.admin.deleteUser(teacher.user_id)
    if (deleteAuthError) return { error: deleteAuthError.message }
  }

  return { success: true }
}

export async function getReceptionUsers(): Promise<ReceptionUser[]> {
  const { user, role } = await getSessionContext()
  if (!user || role !== 'admin') return []

  const admin = createAdminClient()
  const { data } = await admin
    .from('profiles')
    .select('id, full_name, email, phone, role, status, created_at')
    .eq('role', 'reception')
    .order('created_at', { ascending: false })

  return (data || []) as ReceptionUser[]
}

export async function createReceptionUser(formData: {
  full_name: string
  email: string
  phone?: string
}) {
  const { user, role } = await getSessionContext()
  if (!user || role !== 'admin') return { error: 'Accès refusé' }

  const admin = createAdminClient()
  const tempPassword = crypto.randomBytes(16).toString('hex')
  const { data: authUser, error: authError } = await admin.auth.admin.createUser({
    email: formData.email,
    password: tempPassword,
    email_confirm: true,
    user_metadata: {
      full_name: formData.full_name,
      role: 'reception',
    },
  })

  if (authError) return { error: authError.message }

  const { error } = await admin
    .from('profiles')
    .update({
      full_name: formData.full_name,
      phone: formData.phone || null,
      role: 'reception',
      status: 'active',
    })
    .eq('id', authUser.user.id)

  if (error) return { error: error.message }

  return { success: true, tempPassword }
}

export async function updateReceptionUser(
  profileId: string,
  data: Partial<{
    full_name: string
    phone: string
    status: string
  }>
) {
  const { user, role } = await getSessionContext()
  if (!user || role !== 'admin') return { error: 'Accès refusé' }

  const admin = createAdminClient()
  const { error } = await admin
    .from('profiles')
    .update(data)
    .eq('id', profileId)
    .eq('role', 'reception')

  if (error) return { error: error.message }
  return { success: true }
}

export async function resetReceptionPassword(profileId: string) {
  const { user, role } = await getSessionContext()
  if (!user || role !== 'admin') return { error: 'Accès refusé' }

  const admin = createAdminClient()
  const { data: profile, error: profileError } = await admin
    .from('profiles')
    .select('id, full_name, role')
    .eq('id', profileId)
    .eq('role', 'reception')
    .single()

  if (profileError || !profile) {
    return { error: 'Réceptionniste introuvable' }
  }

  const tempPassword = crypto.randomBytes(16).toString('hex')
  const { error: resetError } = await admin.auth.admin.updateUserById(profile.id, {
    password: tempPassword,
  })

  if (resetError) return { error: resetError.message }

  return {
    success: true,
    tempPassword,
    fullName: profile.full_name,
  }
}

export async function deleteReceptionUser(profileId: string) {
  const { user, role } = await getSessionContext()
  if (!user || role !== 'admin') return { error: 'Accès refusé' }

  const admin = createAdminClient()
  const { data: profile, error: profileError } = await admin
    .from('profiles')
    .select('id')
    .eq('id', profileId)
    .eq('role', 'reception')
    .single()

  if (profileError || !profile) {
    return { error: 'Réceptionniste introuvable' }
  }

  const { error: deleteAuthError } = await admin.auth.admin.deleteUser(profile.id)
  if (deleteAuthError) return { error: deleteAuthError.message }

  return { success: true }
}

// ─── ADMIN - ROOMS MANAGEMENT ────────────────────────────────────────────────

export async function getRooms() {
  const isDemo = await isDemoSessionEnabled()

  if (isDemo) {
    return [
      { id: 'room-1', name: 'Salle A1 (Standard)', center: { name: 'Centre Principal' } },
      { id: 'room-2', name: 'Salle B2 (Lab)', center: { name: 'Centre Principal' } },
      { id: 'room-3', name: 'Auditorium', center: { name: 'Annexe Nord' } },
    ]
  }

  const { supabase, user } = await getSessionContext()
  if (!user) return []

  const { data } = await supabase
    .from('rooms')
    .select('*, center:centers(*)')
    .order('created_at', { ascending: false })
  return data || []
}

export async function getCenters() {
  const { supabase, user } = await getSessionContext()
  if (!user) return []

  const { data } = await supabase
    .from('centers')
    .select('*')
    .order('name')
  return data || []
}

export async function createRoom(formData: {
  center_id: string
  name: string
  description?: string
}) {
  const { user, role } = await getSessionContext()
  if (!user || role !== 'admin') return { error: 'Accès refusé' }

  const admin = createAdminClient()
  const { error } = await admin
    .from('rooms')
    .insert(formData)

  if (error) return { error: error.message }
  return { success: true }
}

export async function deleteRoom(roomId: string) {
  const { user, role } = await getSessionContext()
  if (!user || role !== 'admin') return { error: 'Accès refusé' }

  const admin = createAdminClient()
  const { error } = await admin
    .from('rooms')
    .delete()
    .eq('id', roomId)

  if (error) return { error: error.message }
  return { success: true }
}

export async function updateRoom(
  roomId: string,
  data: Partial<{ name: string; description: string; status: string }>
) {
  const { user, role } = await getSessionContext()
  if (!user || role !== 'admin') return { error: 'Accès refusé' }

  const admin = createAdminClient()
  const { error } = await admin.from('rooms').update(data).eq('id', roomId)
  if (error) return { error: error.message }
  return { success: true }
}

export async function createCenter(formData: {
  name: string
  address?: string
  latitude: number
  longitude: number
  allowed_radius_meters?: number
  gps_verification_enabled?: boolean
}) {
  const { user, role } = await getSessionContext()
  if (!user || role !== 'admin') return { error: 'Accès refusé' }

  const admin = createAdminClient()
  const { error } = await admin.from('centers').insert(formData)
  if (error) return { error: error.message }
  return { success: true }
}

export async function updateCenter(
  centerId: string,
  data: Partial<{
    name: string
    address: string
    latitude: number
    longitude: number
    allowed_radius_meters: number
    gps_verification_enabled: boolean
  }>
) {
  const { user, role } = await getSessionContext()
  if (!user || role !== 'admin') return { error: 'Accès refusé' }

  const admin = createAdminClient()
  const { error } = await admin
    .from('centers')
    .update(data)
    .eq('id', centerId)

  if (error) return { error: error.message }
  return { success: true }
}

export async function getAppSettings() {
  const { user, role } = await getSessionContext()
  if (!user || role !== 'admin') return null

  const admin = createAdminClient()
  const { data } = await admin
    .from('app_settings')
    .select('*')
    .eq('id', 'global')
    .maybeSingle()

  return data || null
}

export async function updateAppSettings(
  data: Partial<{
    auto_close_active_sessions: boolean
    auto_close_after_minutes: number
  }>
) {
  const { user, role } = await getSessionContext()
  if (!user || role !== 'admin') return { error: 'Accès refusé' }

  const admin = createAdminClient()
  const { error } = await admin
    .from('app_settings')
    .upsert({
      id: 'global',
      ...data,
    })
    .eq('id', 'global')

  if (error) return { error: error.message }
  return { success: true }
}

export async function deleteCenter(centerId: string) {
  const { user, role } = await getSessionContext()
  if (!user || role !== 'admin') return { error: 'Accès refusé' }

  const admin = createAdminClient()
  const { error } = await admin
    .from('centers')
    .delete()
    .eq('id', centerId)

  if (error) return { error: error.message }
  return { success: true }
}

// ─── ADMIN - STUDENTS & CLASSES ──────────────────────────────────────────────

type StudentClassPayload = {
  center_id: string
  teacher_id?: string | null
  name: string
  level?: string | null
  status?: 'active' | 'inactive'
}

type StudentPayload = {
  center_id?: string | null
  full_name: string
  phone?: string | null
  parent_name?: string | null
  parent_phone?: string | null
  email?: string | null
  payment_due_date?: string | null
  access_status?: 'allowed' | 'blocked'
  access_block_reason?: string | null
  status?: 'active' | 'inactive'
  class_ids?: string[]
}

function normalizeString(value?: string | null) {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}

function normalizeClassIds(classIds?: string[]) {
  return [...new Set((classIds || []).filter(Boolean))]
}

function addMonthsToDate(date: string, months: number) {
  const base = new Date(`${date}T00:00:00`)
  const next = new Date(base)
  next.setMonth(next.getMonth() + months)
  return `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}-${String(next.getDate()).padStart(2, '0')}`
}

async function syncStudentClassMemberships(
  admin: ReturnType<typeof createAdminClient>,
  studentId: string,
  classIds: string[]
) {
  const normalizedClassIds = normalizeClassIds(classIds)
  const { data: existingRows, error: existingError } = await admin
    .from('student_class_members')
    .select('id, class_id')
    .eq('student_id', studentId)

  if (existingError) {
    return { error: existingError.message }
  }

  const existingClassIds = new Set((existingRows || []).map((row) => row.class_id))
  const nextClassIds = new Set(normalizedClassIds)

  const toDelete = (existingRows || [])
    .filter((row) => !nextClassIds.has(row.class_id))
    .map((row) => row.id)

  if (toDelete.length > 0) {
    const { error } = await admin
      .from('student_class_members')
      .delete()
      .in('id', toDelete)

    if (error) return { error: error.message }
  }

  const toInsert = normalizedClassIds
    .filter((classId) => !existingClassIds.has(classId))
    .map((classId) => ({
      class_id: classId,
      student_id: studentId,
    }))

  if (toInsert.length > 0) {
    const { error } = await admin
      .from('student_class_members')
      .insert(toInsert)

    if (error) return { error: error.message }
  }

  return { success: true }
}

export async function getStudentClasses(): Promise<StudentClass[]> {
  const { user, role } = await getSessionContext()
  if (!user || role !== 'admin') return []

  const admin = createAdminClient()
  const { data } = await admin
    .from('student_classes')
    .select('*, center:centers(*), teacher:teachers(id, full_name)')
    .order('name')

  return (data || []) as StudentClass[]
}

export async function getStudents(): Promise<Student[]> {
  const { user, role } = await getSessionContext()
  if (!user || role !== 'admin') return []

  const admin = createAdminClient()
  const { data } = await admin
    .from('students')
    .select('*, center:centers(*)')
    .order('full_name')

  return (data || []) as Student[]
}

export async function createStudentClass(payload: StudentClassPayload) {
  const { user, role } = await getSessionContext()
  if (!user || role !== 'admin') return { error: 'Accès refusé' }

  const admin = createAdminClient()
  const { error } = await admin
    .from('student_classes')
    .insert({
      center_id: payload.center_id,
      teacher_id: payload.teacher_id || null,
      name: payload.name.trim(),
      level: normalizeString(payload.level),
      status: payload.status || 'active',
    })

  if (error) return { error: error.message }
  return { success: true }
}

export async function updateStudentClass(classId: string, payload: Partial<StudentClassPayload>) {
  const { user, role } = await getSessionContext()
  if (!user || role !== 'admin') return { error: 'Accès refusé' }

  const admin = createAdminClient()
  const { error } = await admin
    .from('student_classes')
    .update({
      center_id: payload.center_id,
      teacher_id: payload.teacher_id ?? undefined,
      name: payload.name?.trim(),
      level: payload.level !== undefined ? normalizeString(payload.level) : undefined,
      status: payload.status,
    })
    .eq('id', classId)

  if (error) return { error: error.message }
  return { success: true }
}

export async function createStudent(payload: StudentPayload) {
  const { user, role } = await getSessionContext()
  if (!user || role !== 'admin') return { error: 'Accès refusé' }

  const admin = createAdminClient()
  const classIds = normalizeClassIds(payload.class_ids)
  const centerId = payload.center_id || null

  const { data: student, error } = await admin
    .from('students')
    .insert({
      center_id: centerId,
      full_name: payload.full_name.trim(),
      phone: normalizeString(payload.phone),
      parent_name: normalizeString(payload.parent_name),
      parent_phone: normalizeString(payload.parent_phone),
      email: normalizeString(payload.email),
      payment_due_date: payload.payment_due_date || null,
      access_status: payload.access_status || 'allowed',
      access_block_reason: normalizeString(payload.access_block_reason),
      status: payload.status || 'active',
    })
    .select('id')
    .single()

  if (error || !student) return { error: error?.message || 'Impossible de créer l’étudiant.' }

  const membershipResult = await syncStudentClassMemberships(admin, student.id, classIds)
  if (membershipResult.error) return membershipResult

  return { success: true }
}

export async function updateStudent(studentId: string, payload: Partial<StudentPayload>) {
  const { user, role } = await getSessionContext()
  if (!user || role !== 'admin') return { error: 'Accès refusé' }

  const admin = createAdminClient()
  const { error } = await admin
    .from('students')
    .update({
      center_id: payload.center_id,
      full_name: payload.full_name?.trim(),
      phone: payload.phone !== undefined ? normalizeString(payload.phone) : undefined,
      parent_name: payload.parent_name !== undefined ? normalizeString(payload.parent_name) : undefined,
      parent_phone: payload.parent_phone !== undefined ? normalizeString(payload.parent_phone) : undefined,
      email: payload.email !== undefined ? normalizeString(payload.email) : undefined,
      payment_due_date: payload.payment_due_date !== undefined ? payload.payment_due_date || null : undefined,
      access_status: payload.access_status,
      access_block_reason: payload.access_block_reason !== undefined ? normalizeString(payload.access_block_reason) : undefined,
      status: payload.status,
    })
    .eq('id', studentId)

  if (error) return { error: error.message }

  if (payload.class_ids) {
    const membershipResult = await syncStudentClassMemberships(admin, studentId, payload.class_ids)
    if (membershipResult.error) return membershipResult
  }

  return { success: true }
}

export async function deleteStudent(studentId: string) {
  const { user, role } = await getSessionContext()
  if (!user || role !== 'admin') return { error: 'Accès refusé' }

  const admin = createAdminClient()
  const { error } = await admin
    .from('students')
    .delete()
    .eq('id', studentId)

  if (error) return { error: error.message }
  return { success: true }
}

export async function setStudentAccess(studentId: string, accessStatus: 'allowed' | 'blocked', reason?: string | null) {
  const { user, role } = await getSessionContext()
  if (!user || role !== 'admin') return { error: 'Accès refusé' }

  const admin = createAdminClient()
  const { error } = await admin
    .from('students')
    .update({
      access_status: accessStatus,
      access_block_reason: accessStatus === 'blocked' ? normalizeString(reason) : null,
    })
    .eq('id', studentId)

  if (error) return { error: error.message }
  return { success: true }
}

export async function generateStudentCheckinToken(classId: string) {
  const { user, role } = await getSessionContext()
  if (!user || role !== 'admin') return { error: 'Accès refusé' }

  const admin = createAdminClient()
  const token = crypto.randomUUID()
  const expiresAt = new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString()

  await admin
    .from('student_checkin_tokens')
    .update({ is_active: false })
    .eq('class_id', classId)
    .eq('is_active', true)

  const { data, error } = await admin
    .from('student_checkin_tokens')
    .insert({
      class_id: classId,
      token,
      expires_at: expiresAt,
      is_active: true,
    })
    .select('*')
    .single()

  if (error) return { error: error.message }
  return { data: data as StudentCheckinToken }
}

export async function getStudentAttendanceToday(classId?: string): Promise<StudentAttendance[]> {
  const { user, role } = await getSessionContext()
  if (!user || role !== 'admin') return []

  const admin = createAdminClient()
  let query = admin
    .from('student_attendance')
    .select('*, student:students(*), class:student_classes(*)')
    .eq('attendance_date', formatDateKey(new Date()))
    .order('marked_at', { ascending: false })

  if (classId) query = query.eq('class_id', classId)

  const { data } = await query
  return (data || []) as StudentAttendance[]
}

export async function getStudentPaymentRecords(studentId?: string): Promise<StudentPaymentRecord[]> {
  const { user, role } = await getSessionContext()
  if (!user || role !== 'admin') return []

  const admin = createAdminClient()
  let query = admin
    .from('student_payment_records')
    .select('*')
    .order('paid_at', { ascending: false })
    .order('created_at', { ascending: false })

  if (studentId) query = query.eq('student_id', studentId)

  const { data } = await query.limit(200)
  return (data || []) as StudentPaymentRecord[]
}

export async function recordStudentPayment(payload: {
  student_id: string
  amount?: number | null
  paid_at?: string | null
  period_months?: number
  notes?: string | null
}) {
  const { user, role } = await getSessionContext()
  if (!user || role !== 'admin') return { error: 'Accès refusé' }

  const admin = createAdminClient()
  const paidAt = payload.paid_at || formatDateKey(new Date())
  const periodMonths = payload.period_months || 3
  const nextDueDate = addMonthsToDate(paidAt, periodMonths)

  const { error: paymentError } = await admin
    .from('student_payment_records')
    .insert({
      student_id: payload.student_id,
      paid_at: paidAt,
      amount: payload.amount ?? null,
      period_months: periodMonths,
      next_due_date: nextDueDate,
      notes: normalizeString(payload.notes),
      created_by: user.id,
    })

  if (paymentError) return { error: paymentError.message }

  const { error: studentError } = await admin
    .from('students')
    .update({
      payment_due_date: nextDueDate,
    })
    .eq('id', payload.student_id)

  if (studentError) return { error: studentError.message }

  await admin
    .from('crm_payment_followups')
    .update({
      status: 'resolved',
      promised_payment_date: null,
    })
    .eq('student_id', payload.student_id)
    .neq('status', 'resolved')

  return { success: true, next_due_date: nextDueDate }
}

type CrmLeadPayload = {
  center_id?: string | null
  assigned_to?: string | null
  parent_name: string
  parent_phone?: string | null
  parent_whatsapp?: string | null
  parent_email?: string | null
  audience?: 'junior' | 'adult' | null
  student_name: string
  student_age?: number | null
  student_level?: string | null
  program_interest?: string | null
  availability?: string | null
  goal?: string | null
  source?: string | null
  status?: CrmLeadStatus
  trial_date?: string | null
  next_follow_up_at?: string | null
  last_contact_at?: string | null
  lost_reason?: string | null
}

type CrmTaskPayload = {
  lead_id: string
  assigned_to?: string | null
  task_type?: CrmTaskType
  title: string
  due_at: string
  status?: CrmTaskStatus
}

type ActivityUpsertPayload = {
  type: CrmActivityType
  title: string
  detail?: string | null
  leadId?: string | null
  studentId?: string | null
  actorId?: string | null
  metadata?: Record<string, unknown>
}

type ScoreFactor = { label: string; score: number }

function normalizeEmail(value?: string | null) {
  const normalized = normalizeString(value)
  return normalized ? normalized.toLowerCase() : null
}

function normalizeCrmLeadPayload(payload: Partial<CrmLeadPayload>) {
  return {
    center_id: payload.center_id || null,
    assigned_to: payload.assigned_to || null,
    parent_name: payload.parent_name?.trim(),
    parent_phone: payload.parent_phone !== undefined ? normalizeString(payload.parent_phone) : undefined,
    parent_whatsapp: payload.parent_whatsapp !== undefined ? normalizeString(payload.parent_whatsapp) : undefined,
    parent_email: payload.parent_email !== undefined ? normalizeEmail(payload.parent_email) : undefined,
    audience: payload.audience !== undefined ? payload.audience || null : undefined,
    student_name: payload.student_name?.trim(),
    student_age: payload.student_age ?? undefined,
    student_level: payload.student_level !== undefined ? normalizeString(payload.student_level) : undefined,
    program_interest: payload.program_interest !== undefined ? normalizeString(payload.program_interest) : undefined,
    availability: payload.availability !== undefined ? normalizeString(payload.availability) : undefined,
    goal: payload.goal !== undefined ? normalizeString(payload.goal) : undefined,
    source: payload.source !== undefined ? normalizeString(payload.source) : undefined,
    status: payload.status,
    trial_date: payload.trial_date !== undefined ? payload.trial_date || null : undefined,
    next_follow_up_at: payload.next_follow_up_at !== undefined ? payload.next_follow_up_at || null : undefined,
    last_contact_at: payload.last_contact_at !== undefined ? payload.last_contact_at || null : undefined,
    lost_reason: payload.lost_reason !== undefined ? normalizeString(payload.lost_reason) : undefined,
  }
}

function getLeadTemperature(score: number): CrmLeadTemperature {
  if (score >= 70) return 'hot'
  if (score >= 40) return 'warm'
  return 'cold'
}

function normalizeAudienceToPlanningAudience(value?: string | null) {
  if (!value) return null
  return value === 'junior' ? ['kids', 'teens'] : ['adults']
}

function extractAvailabilityTokens(value?: string | null) {
  const text = (value || '').toLowerCase()
  const tokens: string[] = []
  const dayPairs = [
    ['lundi', 'monday'],
    ['mardi', 'tuesday'],
    ['mercredi', 'wednesday'],
    ['jeudi', 'thursday'],
    ['vendredi', 'friday'],
    ['samedi', 'saturday'],
    ['dimanche', 'sunday'],
  ] as const

  dayPairs.forEach(([fr, en]) => {
    if (text.includes(fr) || text.includes(en)) tokens.push(en)
  })

  if (text.includes('matin') || text.includes('morning')) tokens.push('morning')
  if (text.includes('après-midi') || text.includes('apres-midi') || text.includes('afternoon')) tokens.push('afternoon')
  if (text.includes('soir') || text.includes('evening')) tokens.push('evening')

  return tokens
}

async function recordCrmActivity(admin: ReturnType<typeof createAdminClient>, payload: ActivityUpsertPayload) {
  await logCrmActivity(admin, {
    lead_id: payload.leadId,
    student_id: payload.studentId,
    actor_id: payload.actorId,
    activity_type: payload.type,
    title: payload.title,
    detail: payload.detail,
    metadata: payload.metadata,
  })
}

function buildLeadScoreFactors(params: {
  lead: Pick<CrmLead, 'status' | 'trial_date' | 'next_follow_up_at' | 'last_contact_at' | 'source' | 'program_interest'>
  pendingTasks: number
}) {
  const factors: ScoreFactor[] = []
  const now = new Date()

  if (params.lead.status === 'interested') factors.push({ label: 'Prospect intéressé', score: 20 })
  if (params.lead.status === 'trial_scheduled') factors.push({ label: 'Test planifié', score: 30 })
  if (params.lead.status === 'test_completed') factors.push({ label: 'Test de niveau terminé', score: 25 })
  if (params.lead.program_interest) factors.push({ label: 'Programme demandé précisé', score: 10 })
  if (params.lead.source && ['facebook', 'instagram', 'whatsapp', 'referral'].includes(params.lead.source.toLowerCase())) {
    factors.push({ label: 'Source marketing qualifiée', score: 10 })
  }
  if (params.pendingTasks > 0) factors.push({ label: 'Relance planifiée', score: 10 })

  if (params.lead.trial_date) {
    const diffMs = new Date(params.lead.trial_date).getTime() - now.getTime()
    if (diffMs > 0 && diffMs <= 3 * 24 * 60 * 60 * 1000) {
      factors.push({ label: 'Test imminent', score: 20 })
    }
  }

  if (params.lead.last_contact_at) {
    const daysSinceContact = Math.floor((now.getTime() - new Date(params.lead.last_contact_at).getTime()) / (24 * 60 * 60 * 1000))
    if (daysSinceContact >= 7) factors.push({ label: 'Aucune réponse depuis 7 jours', score: -20 })
    else if (daysSinceContact <= 2) factors.push({ label: 'Contact récent', score: 10 })
  }

  if (params.lead.next_follow_up_at) {
    const followUp = new Date(params.lead.next_follow_up_at)
    if (followUp.getTime() < now.getTime()) factors.push({ label: 'Relance en retard', score: -15 })
  }

  if (params.lead.status === 'lost' || params.lead.status === 'no_response') {
    factors.push({ label: 'Prospect froid ou perdu', score: -30 })
  }

  const score = Math.max(0, factors.reduce((sum, factor) => sum + factor.score, 0))
  return {
    score,
    temperature: getLeadTemperature(score),
    factors,
  }
}

export async function getCrmAssignableUsers(): Promise<Profile[]> {
  const { user, role } = await getSessionContext()
  if (!user || role !== 'admin') return []

  const admin = createAdminClient()
  const { data } = await admin
    .from('profiles')
    .select('id, full_name, email, role, phone, status, created_at')
    .in('role', ['admin', 'reception'])
    .eq('status', 'active')
    .order('full_name')

  return (data || []) as Profile[]
}

export async function getCrmDashboardStats(): Promise<CrmDashboardStats> {
  const { user, role } = await getSessionContext()
  if (!user || role !== 'admin') {
    return {
      newThisWeek: 0,
      followUpsToday: 0,
      overdueFollowUps: 0,
      trialsScheduled: 0,
      enrolledThisMonth: 0,
      lostThisMonth: 0,
    }
  }

  const admin = createAdminClient()
  const now = new Date()
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()
  const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).toISOString()
  const startOfWeek = getLocalWeekStart(now).toISOString()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()

  const [
    newThisWeekRes,
    followUpsTodayRes,
    overdueFollowUpsRes,
    trialsScheduledRes,
    enrolledThisMonthRes,
    lostThisMonthRes,
  ] = await Promise.all([
    admin.from('crm_leads').select('id', { count: 'exact', head: true }).gte('created_at', startOfWeek),
    admin
      .from('crm_leads')
      .select('id', { count: 'exact', head: true })
      .gte('next_follow_up_at', startOfToday)
      .lt('next_follow_up_at', endOfToday)
      .not('status', 'in', '(enrolled,lost)'),
    admin
      .from('crm_leads')
      .select('id', { count: 'exact', head: true })
      .lt('next_follow_up_at', startOfToday)
      .not('status', 'in', '(enrolled,lost)'),
    admin
      .from('crm_leads')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'trial_scheduled'),
    admin
      .from('crm_leads')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'enrolled')
      .gte('updated_at', startOfMonth),
    admin
      .from('crm_leads')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'lost')
      .gte('updated_at', startOfMonth),
  ])

  return {
    newThisWeek: newThisWeekRes.count || 0,
    followUpsToday: followUpsTodayRes.count || 0,
    overdueFollowUps: overdueFollowUpsRes.count || 0,
    trialsScheduled: trialsScheduledRes.count || 0,
    enrolledThisMonth: enrolledThisMonthRes.count || 0,
    lostThisMonth: lostThisMonthRes.count || 0,
  }
}

export async function getCrmSourceStats(): Promise<CrmSourceStat[]> {
  const { user, role } = await getSessionContext()
  if (!user || role !== 'admin') return []

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('crm_leads')
    .select('source, status')

  if (error || !data) return []

  const sourceMap = new Map<string, CrmSourceStat>()

  data.forEach((lead) => {
    const source = (lead.source || 'Source inconnue').trim()
    const current = sourceMap.get(source) || {
      source,
      total: 0,
      enrolled: 0,
      lost: 0,
    }

    current.total += 1
    if (lead.status === 'enrolled') current.enrolled += 1
    if (lead.status === 'lost') current.lost += 1
    sourceMap.set(source, current)
  })

  return Array.from(sourceMap.values()).sort((a, b) => b.total - a.total)
}

export async function getCrmMessageTemplates(): Promise<CrmMessageTemplate[]> {
  const { user, role } = await getSessionContext()
  if (!user || role !== 'admin') return []

  const admin = createAdminClient()
  const { data } = await admin
    .from('crm_message_templates')
    .select('*')
    .eq('is_active', true)
    .order('message_type')
    .order('name')

  return (data || []) as CrmMessageTemplate[]
}

export async function updateCrmMessageTemplate(
  templateId: string,
  payload: Partial<{
    name: string
    message_type: CrmMessageTemplate['message_type']
    message_body: string
    is_active: boolean
  }>,
) {
  const { user, role } = await getSessionContext()
  if (!user || role !== 'admin') return { error: 'Accès refusé' }

  const admin = createAdminClient()
  const { error } = await admin
    .from('crm_message_templates')
    .update({
      name: payload.name?.trim(),
      message_type: payload.message_type,
      message_body: payload.message_body?.trim(),
      is_active: payload.is_active,
    })
    .eq('id', templateId)

  if (error) return { error: error.message }
  return { success: true }
}

export async function refreshCrmLeadScores(): Promise<{ success: true; updated: number } | { error: string }> {
  const { user, role } = await getSessionContext()
  if (!user || role !== 'admin') return { error: 'Accès refusé' }

  const admin = createAdminClient()
  const [leadResult, taskResult] = await Promise.all([
    admin
      .from('crm_leads')
      .select('id, status, trial_date, next_follow_up_at, last_contact_at, source, program_interest'),
    admin
      .from('crm_tasks')
      .select('lead_id, status')
      .eq('status', 'pending'),
  ])

  if (leadResult.error || taskResult.error) {
    return { error: leadResult.error?.message || taskResult.error?.message || 'Impossible de calculer les scores CRM.' }
  }

  const pendingTaskCount = new Map<string, number>()
  ;(taskResult.data || []).forEach((task) => {
    pendingTaskCount.set(task.lead_id, (pendingTaskCount.get(task.lead_id) || 0) + 1)
  })

  const payload = (leadResult.data || []).map((lead) => {
    const scoreData = buildLeadScoreFactors({
      lead: lead as Pick<CrmLead, 'status' | 'trial_date' | 'next_follow_up_at' | 'last_contact_at' | 'source' | 'program_interest'>,
      pendingTasks: pendingTaskCount.get(lead.id) || 0,
    })

    return {
      lead_id: lead.id,
      score: scoreData.score,
      temperature: scoreData.temperature,
      score_factors: scoreData.factors,
      scored_at: new Date().toISOString(),
    }
  })

  if (payload.length === 0) return { success: true, updated: 0 }

  const { error } = await admin
    .from('crm_lead_scores')
    .upsert(payload, { onConflict: 'lead_id' })

  if (error) return { error: error.message }
  return { success: true, updated: payload.length }
}

export async function getHotCrmLeads(): Promise<CrmScoredLead[]> {
  const { user, role } = await getSessionContext()
  if (!user || role !== 'admin') return []

  const refreshed = await refreshCrmLeadScores()
  if ('error' in refreshed) return []

  const admin = createAdminClient()
  const { data } = await admin
    .from('crm_lead_scores')
    .select('lead_id, score, temperature, score_factors, scored_at, updated_at, lead:crm_leads(*, center:centers(*), assignee:profiles!crm_leads_assigned_to_fkey(id, full_name, role), student:students(*))')
    .eq('temperature', 'hot')
    .order('score', { ascending: false })

  return ((data || []) as unknown as CrmScoredLead[]).filter((entry) => Boolean(entry.lead))
}

export async function syncCrmPaymentFollowups(): Promise<{ success: true; updated: number } | { error: string }> {
  const { user, role } = await getSessionContext()
  if (!user || role !== 'admin') return { error: 'Accès refusé' }

  const admin = createAdminClient()
  const today = formatDateKey(new Date())
  const [studentsResult, leadsResult] = await Promise.all([
    admin
      .from('students')
      .select('id, full_name, payment_due_date, access_status')
      .not('payment_due_date', 'is', null),
    admin
      .from('crm_leads')
      .select('id, converted_student_id')
      .not('converted_student_id', 'is', null),
  ])

  if (studentsResult.error || leadsResult.error) {
    return { error: studentsResult.error?.message || leadsResult.error?.message || 'Impossible de synchroniser les impayés CRM.' }
  }

  const leadByStudentId = new Map<string, string>()
  ;(leadsResult.data || []).forEach((lead) => {
    if (lead.converted_student_id) leadByStudentId.set(lead.converted_student_id, lead.id)
  })

  const allStudents = studentsResult.data || []
  const overdueStudents = allStudents.filter((student) => {
    if (!student.payment_due_date) return false
    return student.payment_due_date < today
  })
  const overdueStudentIds = new Set(overdueStudents.map((student) => student.id))

  const { data: existingFollowups } = await admin
    .from('crm_payment_followups')
    .select('id, student_id, status')

  for (const followup of existingFollowups || []) {
    if (!overdueStudentIds.has(followup.student_id) && followup.status !== 'resolved') {
      await admin
        .from('crm_payment_followups')
        .update({ status: 'resolved' })
        .eq('id', followup.id)
    }
  }

  let updated = 0
  for (const student of overdueStudents) {
    const followupPayload = {
      student_id: student.id,
      lead_id: leadByStudentId.get(student.id) || null,
      status: student.access_status === 'blocked' ? 'blocked' : 'overdue',
      amount_due: null,
    }

    const existing = (existingFollowups || []).find((followup) => followup.student_id === student.id && followup.status !== 'resolved')
    if (existing) {
      const { error } = await admin
        .from('crm_payment_followups')
        .update({
          lead_id: followupPayload.lead_id,
          status: followupPayload.status,
          amount_due: followupPayload.amount_due,
        })
        .eq('id', existing.id)

      if (!error) updated += 1
    } else {
      const { error } = await admin
        .from('crm_payment_followups')
        .insert(followupPayload)

      if (!error) updated += 1
    }
  }

  return { success: true, updated }
}

export async function getCrmPaymentFollowups(): Promise<CrmPaymentFollowup[]> {
  const { user, role } = await getSessionContext()
  if (!user || role !== 'admin') return []

  const synced = await syncCrmPaymentFollowups()
  if ('error' in synced) return []

  const admin = createAdminClient()
  const { data } = await admin
    .from('crm_payment_followups')
    .select('*, student:students(*), lead:crm_leads(*, center:centers(*), assignee:profiles!crm_leads_assigned_to_fkey(id, full_name, role), student:students(*))')
    .order('updated_at', { ascending: false })

  return (data || []) as CrmPaymentFollowup[]
}

export async function updateCrmPaymentFollowup(
  followupId: string,
  payload: {
    status?: CrmPaymentFollowupStatus
    promised_payment_date?: string | null
    notes?: string | null
  },
) {
  const { user, role } = await getSessionContext()
  if (!user || role !== 'admin') return { error: 'Accès refusé' }

  const admin = createAdminClient()
  const { data: existingFollowup } = await admin
    .from('crm_payment_followups')
    .select('lead_id, student_id, status, promised_payment_date')
    .eq('id', followupId)
    .maybeSingle()

  const { error } = await admin
    .from('crm_payment_followups')
    .update({
      status: payload.status,
      promised_payment_date: payload.promised_payment_date !== undefined ? payload.promised_payment_date || null : undefined,
      notes: payload.notes !== undefined ? normalizeString(payload.notes) : undefined,
    })
    .eq('id', followupId)

  if (error) return { error: error.message }

  if (existingFollowup?.lead_id || existingFollowup?.student_id) {
    await recordCrmActivity(admin, {
      leadId: existingFollowup?.lead_id || undefined,
      studentId: existingFollowup?.student_id || undefined,
      actorId: user.id,
      type: 'payment_followup',
      title: 'Payment follow-up updated',
      detail: payload.notes || `Payment follow-up status updated to ${payload.status || existingFollowup?.status || 'unchanged'}.`,
      metadata: {
        previous_status: existingFollowup?.status || null,
        next_status: payload.status || existingFollowup?.status || null,
        promised_payment_date: payload.promised_payment_date ?? existingFollowup?.promised_payment_date ?? null,
      },
    })
  }

  return { success: true }
}

export async function getCrmAnalyticsSummary(): Promise<CrmAnalyticsSummary> {
  const { user, role } = await getSessionContext()
  if (!user || role !== 'admin') {
    return {
      totalLeads: 0,
      hotLeads: 0,
      warmLeads: 0,
      coldLeads: 0,
      conversionRate: 0,
      overduePaymentCases: 0,
      promisedPaymentCases: 0,
    }
  }

  await refreshCrmLeadScores()
  await syncCrmPaymentFollowups()

  const admin = createAdminClient()
  const [leadCountRes, scoreRes, enrolledRes, paymentRes] = await Promise.all([
    admin.from('crm_leads').select('id', { count: 'exact', head: true }),
    admin.from('crm_lead_scores').select('temperature'),
    admin.from('crm_leads').select('id', { count: 'exact', head: true }).eq('status', 'enrolled'),
    admin.from('crm_payment_followups').select('status'),
  ])

  const totalLeads = leadCountRes.count || 0
  const scoreRows = scoreRes.data || []
  const paymentRows = paymentRes.data || []

  return {
    totalLeads,
    hotLeads: scoreRows.filter((row) => row.temperature === 'hot').length,
    warmLeads: scoreRows.filter((row) => row.temperature === 'warm').length,
    coldLeads: scoreRows.filter((row) => row.temperature === 'cold').length,
    conversionRate: totalLeads ? Math.round(((enrolledRes.count || 0) / totalLeads) * 100) : 0,
    overduePaymentCases: paymentRows.filter((row) => row.status === 'overdue' || row.status === 'blocked').length,
    promisedPaymentCases: paymentRows.filter((row) => row.status === 'promised').length,
  }
}

export async function getCrmLeadById(leadId: string): Promise<CrmLead | null> {
  const { user, role } = await getSessionContext()
  if (!user || role !== 'admin') return null

  const admin = createAdminClient()
  const { data } = await admin
    .from('crm_leads')
    .select('*, center:centers(*), assignee:profiles!crm_leads_assigned_to_fkey(id, full_name, role), student:students(*), recommended_class:student_classes(*)')
    .eq('id', leadId)
    .maybeSingle()

  return (data as CrmLead | null) || null
}

export async function getCrmNotes(leadId: string): Promise<CrmNote[]> {
  const { user, role } = await getSessionContext()
  if (!user || role !== 'admin') return []

  const admin = createAdminClient()
  const { data } = await admin
    .from('crm_notes')
    .select('*, author:profiles(id, full_name, role)')
    .eq('lead_id', leadId)
    .order('created_at', { ascending: false })

  return (data || []) as CrmNote[]
}

export async function getCrmTasks(leadId: string): Promise<CrmTask[]> {
  const { user, role } = await getSessionContext()
  if (!user || role !== 'admin') return []

  const admin = createAdminClient()
  const { data } = await admin
    .from('crm_tasks')
    .select('*, assignee:profiles!crm_tasks_assigned_to_fkey(id, full_name, role)')
    .eq('lead_id', leadId)
    .order('due_at')

  return (data || []) as CrmTask[]
}

export async function getCrmActivities(leadId: string): Promise<CrmActivity[]> {
  const { user, role } = await getSessionContext()
  if (!user || role !== 'admin') return []

  const admin = createAdminClient()
  const { data } = await admin
    .from('crm_activities')
    .select('*, actor:profiles(id, full_name, role), student:students(*)')
    .eq('lead_id', leadId)
    .order('created_at', { ascending: false })

  return (data || []) as CrmActivity[]
}

export async function createCrmActivity(payload: {
  lead_id: string
  activity_type: CrmActivityType
  title?: string | null
  detail?: string | null
}) {
  const { user, role } = await getSessionContext()
  if (!user || role !== 'admin') return { error: 'Accès refusé' }

  const defaultTitles: Record<CrmActivityType, string> = {
    call: 'Parent called',
    whatsapp: 'WhatsApp message sent',
    note: 'Note added',
    test_completed: 'English Quest completed',
    trial_scheduled: 'Trial scheduled',
    payment_followup: 'Payment follow-up',
    status_change: 'Status changed',
    enrollment: 'Converted to student',
    telegram_alert: 'Telegram alert sent',
    follow_up_reminder: 'Follow-up reminder created',
    class_recommendation: 'Recommended class updated',
  }

  const admin = createAdminClient()
  await recordCrmActivity(admin, {
    leadId: payload.lead_id,
    actorId: user.id,
    type: payload.activity_type,
    title: payload.title?.trim() || defaultTitles[payload.activity_type],
    detail: payload.detail || null,
  })

  return { success: true }
}

export async function getCrmSmartFollowups(): Promise<CrmSmartFollowup[]> {
  const { user, role } = await getSessionContext()
  if (!user || role !== 'admin') return []

  await refreshCrmLeadScores()
  await syncCrmPaymentFollowups()

  const admin = createAdminClient()
  const now = new Date()
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const startOfTomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1)
  const startOfDayAfter = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 2)
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000)
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()

  const [leadsRes, activitiesRes, hotRes, paymentRes, attendanceRes] = await Promise.all([
    admin.from('crm_leads').select('*, student:students(*)'),
    admin.from('crm_activities').select('lead_id, student_id, activity_type, created_at'),
    admin.from('crm_lead_scores').select('lead_id, temperature'),
    admin.from('crm_payment_followups').select('*, student:students(*), lead:crm_leads(*)').eq('status', 'promised'),
    admin.from('student_attendance').select('student_id, attendance_date, status, student:students(*)').eq('status', 'absent').gte('attendance_date', startOfMonth.slice(0, 10)),
  ])

  const leads = (leadsRes.data || []) as CrmLead[]
  const activities = (activitiesRes.data || []) as Array<{ lead_id: string | null; student_id: string | null; activity_type: CrmActivityType; created_at: string }>
  const hotLeadIds = new Set((hotRes.data || []).filter((row) => row.temperature === 'hot').map((row) => row.lead_id))
  const smart: CrmSmartFollowup[] = []

  leads.forEach((lead) => {
    if (lead.placement_test_completed_at && new Date(lead.placement_test_completed_at) <= yesterday) {
      const calledAfterTest = activities.some((activity) =>
        activity.lead_id === lead.id &&
        activity.activity_type === 'call' &&
        new Date(activity.created_at) >= new Date(lead.placement_test_completed_at as string),
      )

      if (!calledAfterTest) {
        smart.push({
          id: `test-no-call-${lead.id}`,
          kind: 'test_completed_no_call',
          severity: 'high',
          title: 'Test completed but no call after 24h',
          detail: `${lead.parent_name} has completed the English Quest, but no call was logged after 24h.`,
          lead_id: lead.id,
          student_id: lead.converted_student_id,
          due_at: lead.placement_test_completed_at,
        })
      }
    }

    if (hotLeadIds.has(lead.id)) {
      const contactedToday = activities.some((activity) =>
        activity.lead_id === lead.id &&
        ['call', 'whatsapp', 'note', 'status_change'].includes(activity.activity_type) &&
        new Date(activity.created_at) >= startOfToday,
      )

      if (!contactedToday) {
        smart.push({
          id: `hot-today-${lead.id}`,
          kind: 'hot_lead_not_contacted',
          severity: 'high',
          title: 'Hot lead not contacted today',
          detail: `${lead.parent_name} is a hot lead and still has no contact logged today.`,
          lead_id: lead.id,
          student_id: lead.converted_student_id,
        })
      }
    }

    if (lead.trial_date) {
      const trialDate = new Date(lead.trial_date)
      if (trialDate >= startOfTomorrow && trialDate < startOfDayAfter) {
        smart.push({
          id: `trial-tomorrow-${lead.id}`,
          kind: 'trial_tomorrow',
          severity: 'medium',
          title: 'Trial scheduled tomorrow',
          detail: `${lead.student_name} has a trial/test scheduled tomorrow.`,
          lead_id: lead.id,
          student_id: lead.converted_student_id,
          due_at: lead.trial_date,
        })
      }
    }
  })

  ;((paymentRes.data || []) as CrmPaymentFollowup[]).forEach((followup) => {
    const promisedDate = followup.promised_payment_date ? new Date(`${followup.promised_payment_date}T00:00:00`) : null
    if (!promisedDate || promisedDate > now) return

    smart.push({
      id: `payment-promise-${followup.id}`,
      kind: 'promised_payment_missing',
      severity: 'high',
      title: 'Promised payment still missing',
      detail: `${followup.student?.parent_name || followup.lead?.parent_name || 'Parent'} promised payment, but nothing has been recorded yet.`,
      lead_id: followup.lead_id,
      student_id: followup.student_id,
      due_at: followup.promised_payment_date,
    })
  })

  const attendanceRows = (attendanceRes.data || []) as Array<{ student_id: string; attendance_date: string; status: 'absent'; student: Student | null }>
  const absenceCount = new Map<string, { count: number; student: Student | null }>()
  attendanceRows.forEach((row) => {
    const current = absenceCount.get(row.student_id) || { count: 0, student: row.student }
    current.count += 1
    absenceCount.set(row.student_id, current)
  })

  absenceCount.forEach((entry, studentId) => {
    if (entry.count < 2) return
    const linkedLead = leads.find((lead) => lead.converted_student_id === studentId)
    smart.push({
      id: `absent-twice-${studentId}`,
      kind: 'student_absent_twice',
      severity: 'medium',
      title: 'Student absent 2 times this month',
      detail: `${entry.student?.full_name || 'Student'} has already been absent ${entry.count} times this month.`,
      lead_id: linkedLead?.id || null,
      student_id: studentId,
    })
  })

  return smart
}

export async function getRecommendedClassesForLead(leadId: string): Promise<CrmRecommendedClassMatch[]> {
  const { user, role } = await getSessionContext()
  if (!user || role !== 'admin') return []

  const admin = createAdminClient()
  const { data: lead } = await admin
    .from('crm_leads')
    .select('*')
    .eq('id', leadId)
    .maybeSingle()

  if (!lead) return []

  const { data: classes } = await admin
    .from('student_classes')
    .select('id, name, level, center_id, status')
    .eq('status', 'active')
    .order('name')

  const { data: sessions } = await admin
    .from('planned_sessions')
    .select('id, class_id, scheduled_date, start_time, audience, status')
    .gte('scheduled_date', formatDateKey(new Date()))
    .eq('status', 'scheduled')
    .order('scheduled_date')
    .order('start_time')

  const leadLevel = (lead.placement_test_level || lead.student_level || '').toLowerCase()
  const availabilityTokens = extractAvailabilityTokens(lead.availability)
  const preferredAudiences = normalizeAudienceToPlanningAudience(lead.audience)

  const sessionMap = new Map<string, Array<{ scheduled_date: string; start_time: string; audience: string | null }>>()
  ;(sessions || []).forEach((session) => {
    if (!session.class_id) return
    const current = sessionMap.get(session.class_id) || []
    current.push({
      scheduled_date: session.scheduled_date,
      start_time: session.start_time,
      audience: session.audience,
    })
    sessionMap.set(session.class_id, current)
  })

  const recommendations = ((classes || []) as Array<{ id: string; name: string; level: string | null; center_id: string | null; status: string }>).map((studentClass) => {
    let score = 0
    const rationale: string[] = []
    const upcomingSessions = sessionMap.get(studentClass.id) || []
    const nextSession = upcomingSessions[0]
    const classLevel = (studentClass.level || '').toLowerCase()

    if (lead.center_id && studentClass.center_id === lead.center_id) {
      score += 15
      rationale.push('Same center')
    }

    if (leadLevel && classLevel.includes(leadLevel)) {
      score += 45
      rationale.push('Level match')
    }

    if (preferredAudiences && nextSession?.audience && preferredAudiences.includes(nextSession.audience)) {
      score += 20
      rationale.push('Audience match')
    }

    if (nextSession && availabilityTokens.length > 0) {
      const sessionDate = new Date(`${nextSession.scheduled_date}T12:00:00`)
      const weekday = sessionDate.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase()
      const hour = Number(nextSession.start_time.slice(0, 2))
      const slot = hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening'

      if (availabilityTokens.includes(weekday)) {
        score += 12
        rationale.push('Day availability match')
      }
      if (availabilityTokens.includes(slot)) {
        score += 8
        rationale.push('Time availability match')
      }
    }

    return {
      class_id: studentClass.id,
      class_name: studentClass.name,
      level: studentClass.level,
      audience: nextSession?.audience || null,
      next_session_at: nextSession ? `${nextSession.scheduled_date}T${nextSession.start_time}` : null,
      score,
      rationale,
    } satisfies CrmRecommendedClassMatch
  })
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)

  const best = recommendations[0]
  if (best) {
    await admin
      .from('crm_leads')
      .update({
        recommended_class_id: best.class_id,
        placement_test_recommended_class: best.next_session_at
          ? `${best.class_name} · ${best.next_session_at.slice(0, 10)} ${best.next_session_at.slice(11, 16)}`
          : best.class_name,
        program_interest: lead.program_interest || best.class_name,
      })
      .eq('id', leadId)
  }

  return recommendations
}

export async function createCrmLead(payload: CrmLeadPayload) {
  const { user, role } = await getSessionContext()
  if (!user || role !== 'admin') return { error: 'Accès refusé' }
  if (!payload.parent_name.trim() || !payload.student_name.trim()) {
    return { error: 'Le parent et l’étudiant sont obligatoires.' }
  }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('crm_leads')
    .insert({
      ...normalizeCrmLeadPayload(payload),
      created_by: user.id,
      status: payload.status || 'new',
    })
    .select('id')
    .single()

  if (error || !data) return { error: error?.message || 'Impossible de créer le prospect.' }
  return { success: true, leadId: data.id }
}

export async function updateCrmLead(leadId: string, payload: Partial<CrmLeadPayload>) {
  const { user, role } = await getSessionContext()
  if (!user || role !== 'admin') return { error: 'Accès refusé' }

  const admin = createAdminClient()
  const normalized = normalizeCrmLeadPayload(payload)
  const { error } = await admin
    .from('crm_leads')
    .update(normalized)
    .eq('id', leadId)

  if (error) return { error: error.message }

  if (normalized.status) {
    await recordCrmActivity(admin, {
      leadId,
      actorId: user.id,
      type: 'status_change',
      title: 'Status changed',
      detail: `Lead status updated to ${normalized.status}.`,
      metadata: { status: normalized.status },
    })
  }

  if (normalized.trial_date) {
    await recordCrmActivity(admin, {
      leadId,
      actorId: user.id,
      type: 'trial_scheduled',
      title: 'Trial scheduled',
      detail: `Trial scheduled for ${normalized.trial_date}.`,
      metadata: { trial_date: normalized.trial_date },
    })
  }

  return { success: true }
}

export async function addCrmLeadNote(leadId: string, note: string) {
  const { user, role } = await getSessionContext()
  if (!user || role !== 'admin') return { error: 'Accès refusé' }

  const content = note.trim()
  if (!content) return { error: 'La note est vide.' }

  const admin = createAdminClient()
  const { error } = await admin
    .from('crm_notes')
    .insert({
      lead_id: leadId,
      author_id: user.id,
      note: content,
    })

  if (error) return { error: error.message }

  await recordCrmActivity(admin, {
    leadId,
    actorId: user.id,
    type: 'note',
    title: 'Note added',
    detail: content,
  })

  return { success: true }
}

export async function deleteCrmLead(leadId: string) {
  const { user, role } = await getSessionContext()
  if (!user || role !== 'admin') return { error: 'Accès refusé' }

  const admin = createAdminClient()
  const { error } = await admin
    .from('crm_leads')
    .delete()
    .eq('id', leadId)

  if (error) return { error: error.message }
  return { success: true }
}

export async function updateCrmLeadStatus(leadId: string, status: CrmLeadStatus) {
  const { user, role } = await getSessionContext()
  if (!user || role !== 'admin') return { error: 'Accès refusé' }

  const admin = createAdminClient()
  const payload: {
    status: CrmLeadStatus
    last_contact_at: string
    trial_date?: string | null
  } = {
    status,
    last_contact_at: new Date().toISOString(),
  }

  if (status !== 'trial_scheduled') {
    payload.trial_date = null
  }

  const { data: leadBefore } = await admin
    .from('crm_leads')
    .select('status, trial_date')
    .eq('id', leadId)
    .maybeSingle()

  const { error } = await admin
    .from('crm_leads')
    .update(payload)
    .eq('id', leadId)

  if (error) return { error: error.message }

  if (leadBefore?.status !== status) {
    await recordCrmActivity(admin, {
      leadId,
      actorId: user.id,
      type: 'status_change',
      title: 'Status changed',
      detail: `${leadBefore?.status || 'unknown'} → ${status}`,
      metadata: { previous_status: leadBefore?.status || null, next_status: status },
    })
  }

  if (status === 'trial_scheduled') {
    await recordCrmActivity(admin, {
      leadId,
      actorId: user.id,
      type: 'trial_scheduled',
      title: 'Trial scheduled',
      detail: payload.trial_date ? `Trial scheduled for ${payload.trial_date}.` : 'Trial status has been scheduled.',
      metadata: { trial_date: payload.trial_date || null },
    })
  }

  return { success: true }
}

export async function createCrmTask(payload: CrmTaskPayload) {
  const { user, role } = await getSessionContext()
  if (!user || role !== 'admin') return { error: 'Accès refusé' }

  const title = payload.title.trim()
  if (!title || !payload.due_at) return { error: 'Titre et échéance obligatoires.' }

  const admin = createAdminClient()
  const { error } = await admin
    .from('crm_tasks')
    .insert({
      lead_id: payload.lead_id,
      assigned_to: payload.assigned_to || null,
      created_by: user.id,
      task_type: payload.task_type || 'follow_up',
      title,
      due_at: payload.due_at,
      status: payload.status || 'pending',
    })

  if (error) return { error: error.message }

  await admin
    .from('crm_leads')
    .update({
      next_follow_up_at: payload.due_at,
    })
    .eq('id', payload.lead_id)

  await recordCrmActivity(admin, {
    leadId: payload.lead_id,
    actorId: user.id,
    type: 'follow_up_reminder',
    title: 'Follow-up reminder created',
    detail: `${title} · due ${payload.due_at}`,
    metadata: {
      due_at: payload.due_at,
      assigned_to: payload.assigned_to || null,
      task_type: payload.task_type || 'follow_up',
    },
  })

  return { success: true }
}

export async function updateCrmTaskStatus(taskId: string, status: CrmTaskStatus) {
  const { user, role } = await getSessionContext()
  if (!user || role !== 'admin') return { error: 'Accès refusé' }

  const admin = createAdminClient()
  const { error } = await admin
    .from('crm_tasks')
    .update({
      status,
      completed_at: status === 'completed' ? new Date().toISOString() : null,
    })
    .eq('id', taskId)

  if (error) return { error: error.message }
  return { success: true }
}

export async function convertCrmLeadToStudent(leadId: string) {
  const { user, role } = await getSessionContext()
  if (!user || role !== 'admin') return { error: 'Accès refusé' }

  const admin = createAdminClient()
  const { data: lead, error: leadError } = await admin
    .from('crm_leads')
    .select('*')
    .eq('id', leadId)
    .single()

  if (leadError || !lead) return { error: 'Prospect introuvable.' }
  if (lead.converted_student_id) return { success: true, studentId: lead.converted_student_id }

  const { data: student, error: studentError } = await admin
    .from('students')
    .insert({
      center_id: lead.center_id,
      full_name: lead.student_name,
      parent_name: lead.parent_name,
      parent_phone: lead.parent_phone,
      phone: lead.parent_whatsapp || lead.parent_phone,
      email: lead.parent_email,
      status: 'active',
      access_status: 'allowed',
    })
    .select('id')
    .single()

  if (studentError || !student) return { error: studentError?.message || 'Impossible de créer l’étudiant.' }

  const { error: updateLeadError } = await admin
    .from('crm_leads')
    .update({
      converted_student_id: student.id,
      status: 'enrolled',
      last_contact_at: new Date().toISOString(),
    })
    .eq('id', leadId)

  if (updateLeadError) return { error: updateLeadError.message }

  await admin
    .from('crm_notes')
    .insert({
      lead_id: leadId,
      author_id: user.id,
      note: `Prospect converti en étudiant (${student.id}).`,
    })

  await recordCrmActivity(admin, {
    leadId,
    studentId: student.id,
    actorId: user.id,
    type: 'enrollment',
    title: 'Converted to student',
    detail: `Lead converted to student ${student.id}.`,
    metadata: { student_id: student.id },
  })

  return { success: true, studentId: student.id }
}

export async function markStudentPresentForToday(payload: {
  student_id: string
  class_id: string
  planned_session_id?: string | null
}) {
  const { user, role } = await getSessionContext()
  if (!user || role !== 'admin') return { error: 'Accès refusé' }

  const admin = createAdminClient()
  const attendanceDate = formatDateKey(new Date())
  const { error } = await admin
    .from('student_attendance')
    .upsert({
      student_id: payload.student_id,
      class_id: payload.class_id,
      planned_session_id: payload.planned_session_id || null,
      attendance_date: attendanceDate,
      status: 'present',
      marked_at: new Date().toISOString(),
      marked_by_user_id: user.id,
      source: 'admin',
      notes: 'Présence ajoutée manuellement par l’administration',
    }, {
      onConflict: 'student_id,class_id,attendance_date',
    })

  if (error) return { error: error.message }
  return { success: true }
}

export async function markStudentPresentForTeacher(payload: {
  student_id: string
  class_id: string
}) {
  const { user, role } = await getSessionContext()
  if (!user || role !== 'teacher') return { error: 'Accès refusé' }

  const admin = createAdminClient()
  const attendanceDate = formatDateKey(new Date())

  const { data: teacher } = await admin
    .from('teachers')
    .select('id')
    .eq('user_id', user.id)
    .single()

  if (!teacher) return { error: 'Profil professeur non trouvé.' }

  const { data: activeSession } = await admin
    .from('attendance_sessions')
    .select('id')
    .eq('teacher_id', teacher.id)
    .eq('status', 'active')
    .maybeSingle()

  if (!activeSession) return { error: 'Aucune séance active.' }

  const { data: plannedSession } = await admin
    .from('planned_sessions')
    .select('id, class_id, teacher_id')
    .eq('linked_session_id', activeSession.id)
    .maybeSingle()

  if (!plannedSession || plannedSession.teacher_id !== teacher.id || plannedSession.class_id !== payload.class_id) {
    return { error: 'Séance ou classe non autorisée.' }
  }

  const { data: membership } = await admin
    .from('student_class_members')
    .select('id')
    .eq('class_id', payload.class_id)
    .eq('student_id', payload.student_id)
    .maybeSingle()

  if (!membership) return { error: 'Étudiant non lié à cette classe.' }

  const { error } = await admin
    .from('student_attendance')
    .upsert({
      student_id: payload.student_id,
      class_id: payload.class_id,
      planned_session_id: plannedSession.id,
      attendance_date: attendanceDate,
      status: 'present',
      marked_at: new Date().toISOString(),
      marked_by_user_id: user.id,
      source: 'teacher',
      notes: 'Présence ajoutée manuellement par le professeur',
    }, {
      onConflict: 'student_id,class_id,attendance_date',
    })

  if (error) return { error: error.message }
  return { success: true }
}

// ─── ADMIN - ATTENDANCE ───────────────────────────────────────────────────────

export async function getAttendanceSessions(filters?: {
  teacherId?: string
  roomId?: string
  status?: string
  dateFrom?: string
  dateTo?: string
}) {
  const { user, role } = await getSessionContext()
  if (!user || role !== 'admin') return []

  const admin = createAdminClient()
  let query = admin
    .from('attendance_sessions')
    .select('*, teacher:teachers(full_name, email), room:rooms(name), center:centers(name)')
    .order('started_at', { ascending: false })

  if (filters?.teacherId) query = query.eq('teacher_id', filters.teacherId)
  if (filters?.roomId) query = query.eq('room_id', filters.roomId)
  if (filters?.status) query = query.eq('status', filters.status)
  if (filters?.dateFrom) query = query.gte('started_at', startOfDateFilter(filters.dateFrom))
  if (filters?.dateTo) query = query.lt('started_at', endOfDateFilterExclusive(filters.dateTo))

  const { data } = await query.limit(200)
  return data || []
}

export async function getCorrectionRequests(filters?: {
  status?: string
  teacherId?: string
}) {
  const { user, role } = await getSessionContext()
  if (!user || role !== 'admin') return []

  const admin = createAdminClient()
  let query = admin
    .from('attendance_correction_requests')
    .select('*, teacher:teachers(full_name, email), session:attendance_sessions(*, room:rooms(name), center:centers(name))')
    .order('created_at', { ascending: false })

  if (filters?.status) query = query.eq('status', filters.status)
  if (filters?.teacherId) query = query.eq('teacher_id', filters.teacherId)

  const { data } = await query.limit(200)
  return (data || []) as AttendanceCorrectionRequest[]
}

export async function getPendingCorrectionRequestsCount() {
  const { user, role } = await getSessionContext()
  if (!user || role !== 'admin') return 0

  const admin = createAdminClient()
  const { count } = await admin
    .from('attendance_correction_requests')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'pending')

  return count || 0
}

export async function reviewCorrectionRequest(
  requestId: string,
  status: 'approved' | 'rejected',
  adminNotes?: string
) {
  const { user, role } = await getSessionContext()
  if (!user || role !== 'admin') return { error: 'Accès refusé' }

  const admin = createAdminClient()
  const { error } = await admin
    .from('attendance_correction_requests')
    .update({
      status,
      admin_notes: adminNotes || null,
      reviewed_at: new Date().toISOString(),
    })
    .eq('id', requestId)
    .eq('status', 'pending')

  if (error) return { error: error.message }
  return { success: true }
}

export async function closeAttendanceSessionManually(sessionId: string) {
  const { user, role } = await getSessionContext()
  if (!user || role !== 'admin') return { error: 'Accès refusé' }

  const admin = createAdminClient()
  const { data: session, error: sessionError } = await admin
    .from('attendance_sessions')
    .select('id, started_at, status')
    .eq('id', sessionId)
    .single()

  if (sessionError || !session) return { error: 'Session introuvable.' }
  if (session.status !== 'active') return { error: 'Seules les sessions actives peuvent être clôturées.' }

  const endedAt = new Date()
  const startedAt = new Date(session.started_at)
  const durationMinutes = Math.max(0, Math.round((endedAt.getTime() - startedAt.getTime()) / 60000))

  const { error: updateError } = await admin
    .from('attendance_sessions')
    .update({
      ended_at: endedAt.toISOString(),
      duration_minutes: durationMinutes,
      end_status: 'accepted',
      status: 'completed',
    })
    .eq('id', sessionId)
    .eq('status', 'active')

  if (updateError) return { error: updateError.message }

  await admin
    .from('planned_sessions')
    .update({
      status: 'completed',
    })
    .eq('linked_session_id', sessionId)
    .in('status', ['scheduled', 'in_progress'])

  return { success: true }
}

// ─── ADMIN - REPORTS ──────────────────────────────────────────────────────────

export async function getTeacherReports(filters: {
  dateFrom: string
  dateTo: string
  teacherId?: string
}): Promise<TeacherReport[]> {
  const { user, role } = await getSessionContext()
  if (!user || role !== 'admin') return []

  const admin = createAdminClient()

  let query = admin
    .from('attendance_sessions')
    .select('teacher_id, duration_minutes, planned_duration_minutes, payable_amount, applied_hourly_rate, teacher:teachers(full_name, hourly_rate, hourly_rate_short, hourly_rate_long)')
    .eq('status', 'completed')
    .gte('started_at', startOfDateFilter(filters.dateFrom))
    .lt('started_at', endOfDateFilterExclusive(filters.dateTo))

  if (filters.teacherId) {
    query = query.eq('teacher_id', filters.teacherId)
  }

  const { data: sessions } = await query

  if (!sessions || sessions.length === 0) return []

  // Group by teacher
  const teacherMap = new Map<string, TeacherReport>()

  for (const session of sessions) {
    const teacherData = session.teacher as unknown as {
      full_name: string
      hourly_rate: number
      hourly_rate_short?: number
      hourly_rate_long?: number
    }
    const existing = teacherMap.get(session.teacher_id) || {
      teacher_id: session.teacher_id,
      teacher_name: teacherData?.full_name || 'Inconnu',
      total_sessions: 0,
      total_hours: 0,
      hourly_rate: teacherData?.hourly_rate || 0,
      estimated_payment: 0,
    }

    existing.total_sessions += 1
    existing.total_hours += getPayableMinutes(session) / 60
    existing.estimated_payment += getPayableAmount(session)

    teacherMap.set(session.teacher_id, existing)
  }

  const reports = Array.from(teacherMap.values())
  reports.forEach((r) => {
    r.total_hours = Math.round(r.total_hours * 100) / 100
    r.estimated_payment = Math.round(r.estimated_payment * 100) / 100
    r.hourly_rate = r.total_hours > 0
      ? Math.round((r.estimated_payment / r.total_hours) * 100) / 100
      : r.hourly_rate
  })

  return reports
}

// ─── ADMIN - UPDATE SESSION ───────────────────────────────────────────────────

export async function updateSessionStatus(
  sessionId: string,
  status: string,
  fraudReason?: string
) {
  const { user, role } = await getSessionContext()
  if (!user || role !== 'admin') return { error: 'Accès refusé' }

  const admin = createAdminClient()
  const { error } = await admin
    .from('attendance_sessions')
    .update({ status, fraud_reason: fraudReason || null })
    .eq('id', sessionId)
  if (error) return { error: error.message }
  return { success: true }
}

export async function manuallyCompletePlannedSession(
  plannedSessionId: string,
  note?: string,
) {
  const { user, role } = await getSessionContext()
  if (!user || role !== 'admin') return { error: 'Accès refusé' }

  const admin = createAdminClient()
  const { data: plannedSession, error: plannedSessionError } = await admin
    .from('planned_sessions')
    .select(`
      *,
      teacher:teachers(hourly_rate, hourly_rate_short, hourly_rate_long)
    `)
    .eq('id', plannedSessionId)
    .single()

  if (plannedSessionError || !plannedSession) {
    return { error: plannedSessionError?.message || 'Séance introuvable.' }
  }

  if (plannedSession.linked_session_id) {
    return { error: 'Cette séance est déjà liée à un pointage existant.' }
  }

  if (!plannedSession.room_id) {
    return { error: 'Impossible de compléter manuellement une séance sans salle assignée.' }
  }

  if (plannedSession.status === 'cancelled') {
    return { error: 'Une séance annulée ne peut pas être complétée manuellement.' }
  }

  const teacher = plannedSession.teacher as TeacherRateSource | null
  if (!teacher) {
    return { error: 'Professeur introuvable pour cette séance.' }
  }

  const [year, month, day] = String(plannedSession.scheduled_date).split('-').map(Number)
  const [startHours, startMinutes] = String(plannedSession.start_time).slice(0, 5).split(':').map(Number)
  const durationMinutes = Number(plannedSession.duration_minutes || 0)

  if (!year || !month || !day || !Number.isFinite(startHours) || !Number.isFinite(startMinutes) || durationMinutes <= 0) {
    return { error: 'Données horaires invalides pour cette séance.' }
  }

  const startedAt = new Date(year, month - 1, day, startHours, startMinutes, 0, 0)
  const endedAt = new Date(startedAt.getTime() + durationMinutes * 60000)
  const appliedHourlyRate = getAppliedHourlyRate(teacher, durationMinutes)
  const payableAmount = roundPayableAmount((durationMinutes / 60) * appliedHourlyRate)
  const adminNote = (note || '').trim()
  const teacherNotes = adminNote
    ? `[Validation admin manuelle] ${adminNote}`
    : '[Validation admin manuelle] Séance marquée complétée sans pointage QR.'

  const { data: session, error: insertError } = await admin
    .from('attendance_sessions')
    .insert({
      teacher_id: plannedSession.teacher_id,
      center_id: plannedSession.campus_id,
      room_id: plannedSession.room_id,
      started_at: startedAt.toISOString(),
      ended_at: endedAt.toISOString(),
      duration_minutes: durationMinutes,
      planned_duration_minutes: durationMinutes,
      session_type: plannedSession.session_type === 'one_to_one' ? 'one_to_one' : 'standard',
      applied_hourly_rate: appliedHourlyRate,
      payable_amount: payableAmount,
      teacher_notes: teacherNotes,
      start_latitude: 0,
      start_longitude: 0,
      end_latitude: 0,
      end_longitude: 0,
      start_status: 'manual_admin',
      end_status: 'manual_admin',
      status: 'completed',
    })
    .select('id')
    .single()

  if (insertError || !session) {
    return { error: insertError?.message || 'Création du pointage manuel impossible.' }
  }

  const { error: updateError } = await admin
    .from('planned_sessions')
    .update({
      linked_session_id: session.id,
      status: 'completed',
      is_override: true,
      override_reason: adminNote || 'Validation admin manuelle',
      updated_at: new Date().toISOString(),
    })
    .eq('id', plannedSessionId)

  if (updateError) {
    await admin
      .from('attendance_sessions')
      .delete()
      .eq('id', session.id)
    return { error: updateError.message }
  }

  return { success: true }
}

// ─── GET USER PROFILE ─────────────────────────────────────────────────────────

export async function getUserProfile() {
  const { cookies } = await import('next/headers')
  const isDemo = await isDemoSessionEnabled()
  const demoRole = (await cookies()).get('demo-role')?.value || 'admin'

  if (isDemo) {
    return {
      id: demoRole === 'admin' ? 'demo-admin-id' : 'demo-teacher-id',
      full_name: demoRole === 'admin' ? 'Admin Démo' : 'Professeur Démo',
      email: demoRole === 'admin' ? 'admin@profcheck.com' : 'teacher@profcheck.com',
      role: demoRole,
      status: 'active'
    }
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  return profile
}

// ─── HELPER: LOG ATTEMPT ──────────────────────────────────────────────────────

async function logAttempt(
  admin: ReturnType<typeof createAdminClient>,
  teacherId: string,
  centerId: string,
  roomId: string,
  token: string,
  action: 'start' | 'end',
  latitude: number,
  longitude: number,
  distance: number,
  status: 'accepted' | 'rejected',
  rejectionReason: string | null
) {
  await admin.from('attendance_attempts').insert({
    teacher_id: teacherId,
    center_id: centerId,
    room_id: roomId,
    token,
    action,
    latitude,
    longitude,
    distance_meters: Math.round(distance),
    status,
    rejection_reason: rejectionReason,
  })
}

// ─── ADMIN - DELETE ───────────────────────────────────────────────────────────

export async function deleteAttendanceSession(sessionId: string) {
  const { user, role } = await getSessionContext()
  if (!user || role !== 'admin') return { error: 'Accès refusé' }

  const admin = createAdminClient()
  const { error } = await admin.from('attendance_sessions').delete().eq('id', sessionId)
  if (error) return { error: error.message }
  return { success: true }
}

export async function deleteStudentPaymentRecord(recordId: string) {
  const { user, role } = await getSessionContext()
  if (!user || role !== 'admin') return { error: 'Accès refusé' }

  const admin = createAdminClient()
  const { error } = await admin.from('student_payment_records').delete().eq('id', recordId)
  if (error) return { error: error.message }
  return { success: true }
}
