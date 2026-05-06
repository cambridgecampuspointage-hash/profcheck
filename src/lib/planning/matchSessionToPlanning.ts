import type { SupabaseClient } from '@supabase/supabase-js'
import type { PlannedSession } from '@/types/planning'

function getCasablancaDateParts(date: Date) {
  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Africa/Casablanca',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  })

  const parts = formatter.formatToParts(date)
  const get = (type: string) => parts.find((part) => part.type === type)?.value || ''
  return {
    date: `${get('year')}-${get('month')}-${get('day')}`,
    hour: Number(get('hour')),
    minute: Number(get('minute')),
  }
}

function timeToMinutes(time: string) {
  const [hour, minute] = time.slice(0, 5).split(':').map(Number)
  return hour * 60 + minute
}

export async function matchAttendanceToPlanning(
  teacherId: string,
  scanTime: Date,
  supabase: SupabaseClient
): Promise<{ matched: true; plannedSession: PlannedSession } | { matched: false; plannedSession: null }> {
  const local = getCasablancaDateParts(scanTime)
  const scanMinutes = local.hour * 60 + local.minute
  const minWindow = scanMinutes - 60
  const maxWindow = scanMinutes + 30

  const { data, error } = await supabase
    .from('planned_sessions')
    .select('*, teacher:teachers(full_name), room:rooms(name), template:schedule_templates(day_of_week, subject)')
    .eq('teacher_id', teacherId)
    .eq('scheduled_date', local.date)
    .eq('status', 'scheduled')

  if (error || !data?.length) {
    return { matched: false, plannedSession: null }
  }

  const candidate = data
    .map((session) => ({ session, startMinutes: timeToMinutes(session.start_time) }))
    .filter(({ startMinutes }) => startMinutes >= minWindow && startMinutes <= maxWindow)
    .sort((left, right) => Math.abs(left.startMinutes - scanMinutes) - Math.abs(right.startMinutes - scanMinutes))[0]

  if (!candidate) {
    return { matched: false, plannedSession: null }
  }

  const { data: updated, error: updateError } = await supabase
    .from('planned_sessions')
    .update({ status: 'in_progress' })
    .eq('id', candidate.session.id)
    .select('*, teacher:teachers(full_name), room:rooms(name), template:schedule_templates(day_of_week, subject)')
    .single()

  if (updateError || !updated) {
    return { matched: false, plannedSession: null }
  }

  return { matched: true, plannedSession: updated as PlannedSession }
}
