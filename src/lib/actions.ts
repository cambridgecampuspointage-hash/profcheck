'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { calculateDistanceMeters } from '@/lib/gps'
import { getDateRanges } from '@/lib/utils'
import crypto from 'crypto'
import type {
  ScanResponse,
  TeacherStats,
  AdminStats,
  TeacherReport,
  AttendanceSession,
  AttendanceCorrectionRequest,
  ReceptionUser,
  TeacherBadge,
  TeacherBadgeSummary,
} from '@/lib/types'

const DEMO_MODE_ENABLED = process.env.NEXT_PUBLIC_ENABLE_DEMO_LOGIN === 'true'

type TeacherBadgeMetrics = {
  completedSessions: number
  monthMinutes: number
  weekCompletedSessions: number
  rejectedAttemptsLast30Days: number
  correctionRequestsLast30Days: number
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
      .select('duration_minutes')
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

  const monthMinutes = (monthSessionsRes.data || []).reduce((sum, session) => sum + (session.duration_minutes || 0), 0)

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
    return {
      data: {
        token: 'demo-token-' + Math.random().toString(36).substring(7),
        center_id: 'demo-center-id',
        room_id: roomId,
        expires_at: new Date(Date.now() + 20000).toISOString(),
      },
    }
  }

  const { user, role } = await getSessionContext()
  if (!user) return { error: 'Non authentifié' }
  if (role !== 'admin') return { error: 'Accès refusé' }

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
  const expiresAt = new Date(Date.now() + 20 * 1000).toISOString() // 20 seconds

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
  longitude: number
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

  if (distance > center.allowed_radius_meters) {
    await logAttempt(admin, teacher.id, centerId, roomId, token, action, latitude, longitude, distance, 'rejected', `Hors zone: ${Math.round(distance)}m`)
    return { success: false, message: `Pointage refusé : vous êtes hors zone du centre (${Math.round(distance)}m).` }
  }

  // 6. Handle START action
  if (action === 'start') {
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
    const { data: session, error } = await admin
      .from('attendance_sessions')
      .insert({
        teacher_id: teacher.id,
        center_id: centerId,
        room_id: roomId,
        started_at: new Date().toISOString(),
        start_latitude: latitude,
        start_longitude: longitude,
        start_status: 'accepted',
        status: 'active',
      })
      .select('*, room:rooms(*), center:centers(*)')
      .single()

    if (error) return { success: false, message: 'Erreur lors de la création de la session.' }

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
    .select('duration_minutes')
    .eq('teacher_id', teacher.id)
    .eq('status', 'completed')
    .gte('started_at', startOfDay)

  const todayMinutes = todaySessions?.reduce((sum, s) => sum + (s.duration_minutes || 0), 0) || 0

  // Week hours
  const { data: weekSessions } = await admin
    .from('attendance_sessions')
    .select('duration_minutes')
    .eq('teacher_id', teacher.id)
    .eq('status', 'completed')
    .gte('started_at', startOfWeek)

  const weekMinutes = weekSessions?.reduce((sum, s) => sum + (s.duration_minutes || 0), 0) || 0

  // Month hours
  const { data: monthSessions } = await admin
    .from('attendance_sessions')
    .select('duration_minutes')
    .eq('teacher_id', teacher.id)
    .eq('status', 'completed')
    .gte('started_at', startOfMonth)

  const monthMinutes = monthSessions?.reduce((sum, s) => sum + (s.duration_minutes || 0), 0) || 0

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
    .select('duration_minutes')
    .eq('status', 'completed')
    .gte('started_at', startOfDay)

  const totalHoursToday = (todaySessions?.reduce((sum, s) => sum + (s.duration_minutes || 0), 0) || 0) / 60

  // Week hours
  const { data: weekSessions } = await admin
    .from('attendance_sessions')
    .select('duration_minutes')
    .eq('status', 'completed')
    .gte('started_at', startOfWeek)

  const totalHoursWeek = (weekSessions?.reduce((sum, s) => sum + (s.duration_minutes || 0), 0) || 0) / 60

  // Month hours
  const { data: monthSessions } = await admin
    .from('attendance_sessions')
    .select('duration_minutes')
    .eq('status', 'completed')
    .gte('started_at', startOfMonth)

  const totalHoursMonth = (monthSessions?.reduce((sum, s) => sum + (s.duration_minutes || 0), 0) || 0) / 60

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
      hourly_rate: formData.hourly_rate || 0,
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
    status: string
  }>
) {
  const { user, role } = await getSessionContext()
  if (!user || role !== 'admin') return { error: 'Accès refusé' }

  const admin = createAdminClient()
  const { error } = await admin
    .from('teachers')
    .update(data)
    .eq('id', teacherId)

  if (error) return { error: error.message }
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
}) {
  const { user, role } = await getSessionContext()
  if (!user || role !== 'admin') return { error: 'Accès refusé' }

  const admin = createAdminClient()
  const { error } = await admin.from('centers').insert(formData)
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
  if (filters?.dateFrom) query = query.gte('started_at', filters.dateFrom)
  if (filters?.dateTo) query = query.lte('started_at', filters.dateTo)

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

// ─── ADMIN - REPORTS ──────────────────────────────────────────────────────────

export async function getTeacherReports(filters: {
  dateFrom: string
  dateTo: string
}): Promise<TeacherReport[]> {
  const { user, role } = await getSessionContext()
  if (!user || role !== 'admin') return []

  const admin = createAdminClient()

  const { data: sessions } = await admin
    .from('attendance_sessions')
    .select('teacher_id, duration_minutes, teacher:teachers(full_name, hourly_rate)')
    .eq('status', 'completed')
    .gte('started_at', filters.dateFrom)
    .lte('started_at', filters.dateTo)

  if (!sessions || sessions.length === 0) return []

  // Group by teacher
  const teacherMap = new Map<string, TeacherReport>()

  for (const session of sessions) {
    const teacherData = session.teacher as unknown as { full_name: string; hourly_rate: number }
    const existing = teacherMap.get(session.teacher_id) || {
      teacher_id: session.teacher_id,
      teacher_name: teacherData?.full_name || 'Inconnu',
      total_sessions: 0,
      total_hours: 0,
      hourly_rate: teacherData?.hourly_rate || 0,
      estimated_payment: 0,
    }

    existing.total_sessions += 1
    existing.total_hours += (session.duration_minutes || 0) / 60

    teacherMap.set(session.teacher_id, existing)
  }

  const reports = Array.from(teacherMap.values())
  reports.forEach((r) => {
    r.total_hours = Math.round(r.total_hours * 100) / 100
    r.estimated_payment = Math.round(r.total_hours * r.hourly_rate * 100) / 100
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
