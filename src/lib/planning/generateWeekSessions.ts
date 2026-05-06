'use client'

import { createClient } from '@/lib/supabase/client'
export { formatIsoDate, formatWeekLabel, getWeekDates, getWeekStart, parseLocalIsoDate } from '@/lib/planning/dateUtils'
import { formatIsoDate, getWeekStart } from '@/lib/planning/dateUtils'

export async function generateWeekSessions(weekStart: Date): Promise<{ created: number; error: string | null }> {
  const supabase = createClient()
  const monday = getWeekStart(weekStart)
  const { data, error } = await supabase.rpc('generate_week_sessions', {
    week_start: formatIsoDate(monday),
  })

  if (error) {
    return { created: 0, error: error.message }
  }

  return { created: Number(data || 0), error: null }
}
