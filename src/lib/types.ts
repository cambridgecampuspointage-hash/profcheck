export interface Profile {
  id: string
  full_name: string | null
  email: string | null
  role: 'admin' | 'teacher' | 'reception'
  phone: string | null
  status: string
  created_at: string
}

export interface Teacher {
  id: string
  user_id: string | null
  full_name: string
  email: string | null
  phone: string | null
  languages: string[] | null
  hourly_rate: number
  status: string
  created_at: string
}

export interface ReceptionUser {
  id: string
  full_name: string | null
  email: string | null
  phone: string | null
  role: 'reception'
  status: string
  created_at: string
}

export interface Center {
  id: string
  name: string
  address: string | null
  latitude: number
  longitude: number
  allowed_radius_meters: number
  created_at: string
}

export interface Room {
  id: string
  center_id: string
  name: string
  description: string | null
  status: string
  created_at: string
  center?: Center
}

export interface QrToken {
  id: string
  center_id: string
  room_id: string
  token: string
  expires_at: string
  created_at: string
  is_active: boolean
}

export interface AttendanceSession {
  id: string
  teacher_id: string
  center_id: string
  room_id: string
  started_at: string
  ended_at: string | null
  duration_minutes: number | null
  start_latitude: number
  start_longitude: number
  end_latitude: number | null
  end_longitude: number | null
  start_status: string
  end_status: string | null
  status: 'active' | 'completed' | 'rejected' | 'pending_review'
  fraud_reason: string | null
  created_at: string
  teacher?: Teacher
  room?: Room
  center?: Center
}

export interface AttendanceAttempt {
  id: string
  teacher_id: string
  center_id: string
  room_id: string
  token: string
  action: 'start' | 'end'
  latitude: number
  longitude: number
  distance_meters: number
  status: 'accepted' | 'rejected'
  rejection_reason: string | null
  created_at: string
  teacher?: Teacher
  room?: Room
}

export interface AttendanceCorrectionRequest {
  id: string
  teacher_id: string
  session_id: string | null
  request_type: 'missed_start' | 'missed_end' | 'gps_issue' | 'other'
  requested_start_at: string | null
  requested_end_at: string | null
  reason: string
  status: 'pending' | 'approved' | 'rejected'
  admin_notes: string | null
  reviewed_at: string | null
  created_at: string
  teacher?: Teacher
  session?: AttendanceSession
  room?: Room
}

export interface Course {
  id: string
  teacher_id: string
  room_id: string
  language: string | null
  group_name: string | null
  planned_start: string
  planned_end: string
  status: string
  created_at: string
}

export interface QrPayload {
  token: string
  center_id: string
  room_id: string
  expires_at: string
}

export interface ScanRequest {
  token: string
  center_id: string
  room_id: string
  action: 'start' | 'end'
  latitude: number
  longitude: number
}

export interface ScanResponse {
  success: boolean
  message: string
  session?: AttendanceSession
}

export interface TeacherStats {
  todayHours: number
  weekHours: number
  monthHours: number
  activeSession: AttendanceSession | null
}

export interface AdminStats {
  totalTeachers: number
  activeTeachersNow: number
  totalHoursToday: number
  totalHoursWeek: number
  totalHoursMonth: number
  recentAttendance: AttendanceSession[]
  rejectedAttempts: AttendanceAttempt[]
}

export interface TeacherReport {
  teacher_id: string
  teacher_name: string
  total_sessions: number
  total_hours: number
  hourly_rate: number
  estimated_payment: number
}

export interface TeacherBadge {
  id: string
  name: string
  description: string
  tone: 'gold' | 'navy' | 'emerald' | 'rose'
}

export interface TeacherBadgeSummary {
  teacher_id: string
  badges: TeacherBadge[]
}
