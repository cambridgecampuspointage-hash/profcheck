export type SessionStatus = 'scheduled' | 'in_progress' | 'completed' | 'absent' | 'cancelled'

export type DayOfWeek = 0 | 1 | 2 | 3 | 4 | 5
export type Audience = 'kids' | 'teens' | 'adults'

export interface ScheduleTemplate {
  id: string
  campus_id: string
  teacher_id: string
  room_id: string | null
  day_of_week: DayOfWeek
  start_time: string
  duration_minutes: 60 | 90 | 120 | 180
  session_type: 'group' | 'one_to_one'
  group_label: string | null
  audience: Audience | null
  subject: string | null
  is_active: boolean
  created_by: string | null
  created_at: string
  updated_at: string
  teacher?: { full_name: string; hourly_rate: number }
  room?: { name: string } | null
  campus?: { name: string }
}

export interface PlannedSession {
  id: string
  template_id: string | null
  campus_id: string
  teacher_id: string
  room_id: string | null
  scheduled_date: string
  start_time: string
  duration_minutes: 60 | 90 | 120 | 180
  session_type: 'group' | 'one_to_one'
  group_label: string | null
  audience: Audience | null
  subject: string | null
  status: SessionStatus
  is_override: boolean
  override_reason: string | null
  linked_session_id: string | null
  created_by: string | null
  created_at: string
  updated_at: string
  teacher?: { full_name: string }
  room?: { name: string } | null
  template?: { day_of_week: DayOfWeek; subject: string | null } | null
  linked_session?: {
    start_time: string | null
    end_time: string | null
    duration_minutes: number | null
  } | null
}

export const DAY_LABELS: Record<DayOfWeek, string> = {
  0: 'Lundi',
  1: 'Mardi',
  2: 'Mercredi',
  3: 'Jeudi',
  4: 'Vendredi',
  5: 'Samedi',
}

export const DURATION_OPTIONS = [
  { value: 60 as const, label: '1h' },
  { value: 90 as const, label: '1h30' },
  { value: 120 as const, label: '2h' },
  { value: 180 as const, label: '3h' },
]

export const SESSION_TYPE_OPTIONS = [
  { value: 'group' as const, label: 'Groupe' },
  { value: 'one_to_one' as const, label: 'One-to-one' },
]

export const AUDIENCE_OPTIONS = [
  { value: 'kids' as const, label: 'Kids' },
  { value: 'teens' as const, label: 'Teens' },
  { value: 'adults' as const, label: 'Adults' },
]
