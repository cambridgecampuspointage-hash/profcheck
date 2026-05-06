'use client'

import { createClient } from '@/lib/supabase/client'

export function formatIsoDate(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function parseLocalIsoDate(value: string): Date {
  const [year, month, day] = value.split('-').map(Number)
  return new Date(year, (month || 1) - 1, day || 1)
}

export function getWeekStart(date: Date): Date {
  const copy = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  const day = copy.getDay()
  const diff = day === 0 ? -6 : 1 - day
  copy.setDate(copy.getDate() + diff)
  copy.setHours(0, 0, 0, 0)
  return copy
}

export function getWeekDates(weekStart: Date): Date[] {
  return Array.from({ length: 6 }, (_, index) => {
    const current = new Date(weekStart)
    current.setDate(weekStart.getDate() + index)
    return current
  })
}

export function formatWeekLabel(weekStart: Date): string {
  const weekDates = getWeekDates(weekStart)
  const start = weekDates[0]
  const end = weekDates[5]
  const sameMonth = start.getMonth() === end.getMonth()
  const startLabel = start.toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: sameMonth ? undefined : 'long',
  })
  const endLabel = end.toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })

  return `Semaine du ${startLabel} au ${endLabel}`
}

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
