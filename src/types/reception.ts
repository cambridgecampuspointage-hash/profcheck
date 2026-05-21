export type ReceptionAttendanceStatus =
  | 'planned'
  | 'present'
  | 'late'
  | 'on_break'
  | 'completed'
  | 'absent'
  | 'partial'

export type ReceptionAnomalyType =
  | 'late_arrival'
  | 'early_leave'
  | 'long_break'
  | 'absence'
  | 'missing_clock_out'

export interface ReceptionProfile {
  id: string
  full_name: string | null
  email: string | null
  role: 'reception'
}

export interface StaffSchedule {
  id: string
  user_id: string
  role: 'reception'
  expected_start: string
  expected_end: string
  max_break_minutes: number
  work_days: number[]
  created_by: string | null
  created_at: string
  updated_at: string
  profile?: ReceptionProfile | null
}

export interface StaffAttendance {
  id: string
  user_id: string
  date: string
  clock_in: string | null
  clock_out: string | null
  signature_data_url: string | null
  break_start: string | null
  break_end: string | null
  late_minutes: number
  early_leave_minutes: number
  break_overtime_minutes: number
  total_present_minutes: number
  status: ReceptionAttendanceStatus
  created_at: string
  updated_at: string
  profile?: ReceptionProfile | null
}

export interface ReceptionAnomaly {
  type: ReceptionAnomalyType
  title: string
  severity: 'warning' | 'critical'
  message: string
  minutes: number
}

export interface ReceptionDayKpis {
  expectedRange: string
  actualRange: string
  totalPresentLabel: string
  breakLabel: string
  statusLabel: string
  statusTone: 'neutral' | 'warning' | 'danger' | 'success'
  clockedIn: boolean
  onBreak: boolean
  completed: boolean
  lateMinutes: number
  earlyLeaveMinutes: number
  breakOvertimeMinutes: number
  anomalies: ReceptionAnomaly[]
}

export interface ReceptionMonthSummaryRow {
  user_id: string
  full_name: string
  workedDays: number
  lateCount: number
  absenceCount: number
  longBreakCount: number
  earlyLeaveCount: number
  missingClockOutCount: number
  totalPresentMinutes: number
  averagePresentMinutes: number
  lateDetails: ReceptionMonthSummaryDetail[]
  absenceDetails: ReceptionMonthSummaryDetail[]
  longBreakDetails: ReceptionMonthSummaryDetail[]
  earlyLeaveDetails: ReceptionMonthSummaryDetail[]
  missingClockOutDetails: ReceptionMonthSummaryDetail[]
}

export interface ReceptionMonthSummaryDetail {
  date: string
  minutes?: number
  label: string
}

export interface WorkSchedulePayload {
  id?: string
  user_id: string
  expected_start: string
  expected_end: string
  max_break_minutes: number
  work_days: number[]
}

export const WEEKDAY_OPTIONS = [
  { value: 0, label: 'Lundi' },
  { value: 1, label: 'Mardi' },
  { value: 2, label: 'Mercredi' },
  { value: 3, label: 'Jeudi' },
  { value: 4, label: 'Vendredi' },
  { value: 5, label: 'Samedi' },
]
