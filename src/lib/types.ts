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
  hourly_rate_short: number
  hourly_rate_long: number
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
  gps_verification_enabled: boolean
  created_at: string
}

export interface AppSettings {
  id: 'global'
  auto_close_active_sessions: boolean
  auto_close_after_minutes: number
  created_at: string
  updated_at: string
}

export interface Student {
  id: string
  center_id: string | null
  full_name: string
  phone: string | null
  parent_name: string | null
  parent_phone: string | null
  email: string | null
  payment_due_date: string | null
  access_status: 'allowed' | 'blocked'
  access_block_reason: string | null
  status: 'active' | 'inactive'
  created_at: string
  updated_at: string
  center?: Center | null
}

export interface StudentClass {
  id: string
  center_id: string
  teacher_id: string | null
  name: string
  level: string | null
  status: 'active' | 'inactive'
  created_at: string
  updated_at: string
  center?: Center | null
  teacher?: Pick<Teacher, 'id' | 'full_name'> | null
}

export interface StudentClassMember {
  id: string
  class_id: string
  student_id: string
  joined_at: string
  student?: Student | null
  class?: StudentClass | null
}

export interface StudentAttendance {
  id: string
  student_id: string
  class_id: string
  planned_session_id: string | null
  attendance_date: string
  status: 'present' | 'absent' | 'late' | 'excused'
  marked_at: string
  marked_by_user_id: string | null
  source: 'qr' | 'teacher' | 'admin' | 'reception'
  signature_data_url: string | null
  notes: string | null
  student?: Student | null
  class?: StudentClass | null
}

export interface StudentCheckinToken {
  id: string
  class_id: string
  planned_session_id: string | null
  token: string
  expires_at: string
  is_active: boolean
  created_at: string
}

export interface StudentPaymentRecord {
  id: string
  student_id: string
  paid_at: string
  amount: number | null
  period_months: number
  next_due_date: string
  notes: string | null
  created_by: string | null
  created_at: string
}

export type CrmLeadStatus =
  | 'new'
  | 'contacted'
  | 'interested'
  | 'trial_scheduled'
  | 'test_completed'
  | 'enrolled'
  | 'lost'
  | 'no_response'

export type CrmTaskType = 'follow_up' | 'call' | 'trial' | 'meeting' | 'other'
export type CrmTaskStatus = 'pending' | 'completed' | 'cancelled'
export type CrmLeadTemperature = 'hot' | 'warm' | 'cold'

export interface CrmLead {
  id: string
  center_id: string | null
  created_by: string | null
  assigned_to: string | null
  converted_student_id: string | null
  parent_name: string
  parent_phone: string | null
  parent_whatsapp: string | null
  parent_email: string | null
  audience: 'junior' | 'adult' | null
  student_name: string
  student_age: number | null
  student_level: string | null
  program_interest: string | null
  availability: string | null
  goal: string | null
  source: string | null
  status: CrmLeadStatus
  trial_date: string | null
  next_follow_up_at: string | null
  last_contact_at: string | null
  placement_test_completed_at: string | null
  placement_test_score: number | null
  placement_test_total_questions: number | null
  placement_test_xp: number | null
  placement_test_badge: string | null
  placement_test_level: string | null
  placement_test_recommended_class: string | null
  lost_reason: string | null
  created_at: string
  updated_at: string
  center?: Center | null
  assignee?: Pick<Profile, 'id' | 'full_name' | 'role'> | null
  student?: Student | null
}

export interface CrmNote {
  id: string
  lead_id: string
  author_id: string | null
  note: string
  created_at: string
  author?: Pick<Profile, 'id' | 'full_name' | 'role'> | null
}

export interface CrmTask {
  id: string
  lead_id: string
  assigned_to: string | null
  created_by: string | null
  task_type: CrmTaskType
  title: string
  due_at: string
  status: CrmTaskStatus
  completed_at: string | null
  created_at: string
  updated_at: string
  assignee?: Pick<Profile, 'id' | 'full_name' | 'role'> | null
}

export type CrmMessageTemplateType = 'first_contact' | 'follow_up' | 'trial_invite' | 'trial_reminder'

export interface CrmMessageTemplate {
  id: string
  name: string
  message_type: CrmMessageTemplateType
  message_body: string
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface CrmDashboardStats {
  newThisWeek: number
  followUpsToday: number
  overdueFollowUps: number
  trialsScheduled: number
  enrolledThisMonth: number
  lostThisMonth: number
}

export interface CrmSourceStat {
  source: string
  total: number
  enrolled: number
  lost: number
}

export interface CrmLeadScore {
  lead_id: string
  score: number
  temperature: CrmLeadTemperature
  score_factors: Array<{ label: string; score: number }>
  scored_at: string
  updated_at: string
}

export interface CrmScoredLead extends CrmLeadScore {
  lead: CrmLead
}

export type CrmPaymentFollowupStatus = 'overdue' | 'promised' | 'resolved' | 'blocked'

export interface CrmPaymentFollowup {
  id: string
  student_id: string
  lead_id: string | null
  status: CrmPaymentFollowupStatus
  amount_due: number | null
  promised_payment_date: string | null
  notes: string | null
  created_at: string
  updated_at: string
  student?: Student | null
  lead?: CrmLead | null
}

export interface CrmAnalyticsSummary {
  totalLeads: number
  hotLeads: number
  warmLeads: number
  coldLeads: number
  conversionRate: number
  overduePaymentCases: number
  promisedPaymentCases: number
}

export interface PlacementQuestion {
  id: string
  language_code: 'english'
  mission_order: number
  question_order: number
  mission_title: string
  mission_icon: string
  prompt: string
  context_text: string | null
  option_a: string
  option_b: string
  option_c: string
  option_d: string
  correct_option: 'A' | 'B' | 'C' | 'D'
  cefr_level: string
  xp_points: number
  is_active: boolean
  created_at: string
}

export type PlacementQuestionPublic = Omit<PlacementQuestion, 'correct_option' | 'created_at'>

export interface PlacementAttempt {
  id: string
  lead_id: string | null
  full_name: string
  contact_phone: string
  age: number | null
  audience: 'junior' | 'adult'
  language_code: 'english'
  status: 'started' | 'completed' | 'abandoned'
  total_questions: number
  answered_questions: number
  correct_answers: number
  raw_score: number
  xp_score: number
  current_streak: number
  best_streak: number
  badge: string | null
  estimated_level: string | null
  recommended_class: string | null
  completed_at: string | null
  created_at: string
  updated_at: string
}

export interface PlacementAnswer {
  id: string
  attempt_id: string
  question_id: string
  selected_option: 'A' | 'B' | 'C' | 'D'
  is_correct: boolean
  answered_at: string
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
  planned_duration_minutes: number | null
  session_type: 'standard' | 'one_to_one'
  applied_hourly_rate: number | null
  payable_amount: number | null
  signature_data_url: string | null
  teacher_notes: string | null
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
  access_code?: string
  gps_verification_enabled?: boolean
}

export interface ScanRequest {
  token: string
  center_id: string
  room_id: string
  action: 'start' | 'end'
  latitude: number
  longitude: number
  gps_accuracy_meters?: number
  planned_duration_minutes?: number
  session_type?: 'standard' | 'one_to_one'
  signature_data_url?: string
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
