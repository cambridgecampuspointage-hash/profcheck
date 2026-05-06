import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { format, formatDistanceToNow } from 'date-fns'
import { fr } from 'date-fns/locale'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(dateString: string): string {
  return format(new Date(dateString), 'dd/MM/yyyy', { locale: fr })
}

export function formatTime(dateString: string): string {
  return format(new Date(dateString), 'HH:mm', { locale: fr })
}

export function formatDateTime(dateString: string): string {
  return format(new Date(dateString), 'dd/MM/yyyy HH:mm', { locale: fr })
}

export function formatRelative(dateString: string): string {
  return formatDistanceToNow(new Date(dateString), { addSuffix: true, locale: fr })
}

export function minutesToHoursMinutes(minutes: number): string {
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  if (hours === 0) return `${mins}min`
  if (mins === 0) return `${hours}h`
  return `${hours}h ${mins}min`
}

export function hoursDecimal(minutes: number): string {
  return (minutes / 60).toFixed(1)
}

export function sessionTypeLabel(value?: string): string {
  if (value === 'one_to_one') return 'One-to-one'
  return 'Normal'
}

/**
 * Generate CSV string from rows of data.
 */
export function generateCsv(
  headers: string[],
  rows: string[][],
  delimiter = ','
): string {
  const headerLine = headers.join(delimiter)
  const dataLines = rows.map((row) =>
    row.map((cell) => `"${(cell ?? '').replace(/"/g, '""')}"`).join(delimiter)
  )
  return [headerLine, ...dataLines].join('\n')
}

/**
 * Download a string as a CSV file.
 */
export function downloadCsv(csvContent: string, filename: string): void {
  const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' })
  const link = document.createElement('a')
  link.href = URL.createObjectURL(blob)
  link.download = filename
  link.click()
  URL.revokeObjectURL(link.href)
}

/**
 * Get the start of today, this week (Monday), and this month in ISO.
 */
export function getDateRanges() {
  const now = new Date()
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  
  const dayOfWeek = now.getDay()
  const diff = dayOfWeek === 0 ? 6 : dayOfWeek - 1 // Monday = 0
  const startOfWeek = new Date(startOfDay)
  startOfWeek.setDate(startOfDay.getDate() - diff)

  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)

  return {
    startOfDay: startOfDay.toISOString(),
    startOfWeek: startOfWeek.toISOString(),
    startOfMonth: startOfMonth.toISOString(),
  }
}

export function startOfDateFilter(dateString: string): string {
  const [year, month, day] = dateString.split('-').map(Number)
  return new Date(year, month - 1, day, 0, 0, 0, 0).toISOString()
}

export function endOfDateFilterExclusive(dateString: string): string {
  const [year, month, day] = dateString.split('-').map(Number)
  return new Date(year, month - 1, day + 1, 0, 0, 0, 0).toISOString()
}
