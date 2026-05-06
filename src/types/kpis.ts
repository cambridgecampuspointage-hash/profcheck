export type KpiTrend = 'up' | 'down' | 'neutral'
export type KpiStatus = 'good' | 'warning' | 'critical'

export const COMPLETION_RATE_WARNING = 85
export const COMPLETION_RATE_CRITICAL = 75
export const ABSENCE_RATE_WARNING = 10
export const ABSENCE_RATE_CRITICAL = 20
export const PUNCTUALITY_WARNING = 85
export const PUNCTUALITY_CRITICAL = 70
export const OCCUPANCY_WARNING = 85
export const OCCUPANCY_LOW = 50

export interface LateTeacher {
  teacher_name: string
  scheduled_time: string
  minutes_late: number
  room: string
}

export interface DayKpi {
  date: string
  label: string
  planned: number
  completed: number
  absent: number
}

export interface TeacherWeekKpi {
  teacher_id: string
  teacher_name: string
  planned: number
  completed: number
  absent: number
  punctualityRate: number
  completionRate: number
  byDay: number[]
}

export interface TeacherMonthKpi {
  teacher_id: string
  teacher_name: string
  plannedHours: number
  completedHours: number
  absentHours: number
  sessionsCount: number
  oneToOneCount: number
  hourlyRate: number
  estimatedPayMAD: number
  absenceCount: number
  lateCount: number
  punctualityRate: number
  completionRate: number
  byDay: number[]
}

export interface RoomKpi {
  room_id: string
  room_name: string
  totalSessions: number
  totalHours: number
  occupancyRate: number
}

export interface MonthComparison {
  sessionsChange: number
  hoursChange: number
  payrollChange: number
  absenceChange: number
  oneToOneChange: number
}

export interface TodayKpis {
  sessionsInProgress: number
  sessionsAbsent: number
  sessionsScheduledRemaining: number
  sessionsOutOfPlanning: number
  alertsCount: number
  activeRooms: string[]
  lateTeachers: LateTeacher[]
}

export interface WeekKpis {
  totalPlanned: number
  totalCompleted: number
  totalAbsent: number
  totalCancelled: number
  completionRate: number
  absenceRate: number
  byDay: DayKpi[]
  byTeacher: TeacherWeekKpi[]
}

export interface MonthKpis {
  totalPlannedHours: number
  totalCompletedHours: number
  totalAbsentHours: number
  completionRate: number
  absenceRate: number
  totalEstimatedPayroll: number
  averageCostPerHour: number
  oneToOnePercent: number
  groupPercent: number
  byTeacher: TeacherMonthKpi[]
  byRoom: RoomKpi[]
  vsLastMonth: MonthComparison
}

export interface NextSession {
  date: string
  start_time: string
  duration_minutes: number
  room_name: string
  session_type: string
}

export interface WeekSummary {
  weekLabel: string
  completed: number
  absent: number
  hours: number
}

export interface TeacherMonthKpis {
  plannedHours: number
  completedHours: number
  absentHours: number
  estimatedPayMAD: number
  sessionsCount: number
  oneToOneCount: number
  absenceCount: number
  lateCount: number
  punctualityRate: number
  completionRate: number
  nextSessions: NextSession[]
  byWeek: WeekSummary[]
}

export function getTrend(current: number, previous: number): KpiTrend {
  const difference = Number((current - previous).toFixed(2))
  if (difference > 0) return 'up'
  if (difference < 0) return 'down'
  return 'neutral'
}

export function getStatus(value: number, warningThreshold: number, criticalThreshold: number): KpiStatus {
  const lowerIsWorse = criticalThreshold < warningThreshold

  if (lowerIsWorse) {
    if (value <= criticalThreshold) return 'critical'
    if (value <= warningThreshold) return 'warning'
    return 'good'
  }

  if (value >= criticalThreshold) return 'critical'
  if (value >= warningThreshold) return 'warning'
  return 'good'
}
