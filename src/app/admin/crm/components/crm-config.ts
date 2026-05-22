import type { CrmLeadStatus } from '@/lib/types'

export const CRM_STATUS_OPTIONS: Array<{ value: CrmLeadStatus; label: string }> = [
  { value: 'new', label: 'Nouveau' },
  { value: 'contacted', label: 'Contacté' },
  { value: 'interested', label: 'Intéressé' },
  { value: 'trial_scheduled', label: 'Test prévu' },
  { value: 'test_completed', label: 'Test terminé' },
  { value: 'enrolled', label: 'Inscrit' },
  { value: 'lost', label: 'Perdu' },
  { value: 'no_response', label: 'Ne répond pas' },
]

export const CRM_STATUS_STYLES: Record<CrmLeadStatus, { bg: string; text: string }> = {
  new: { bg: '#dbeafe', text: '#1d4ed8' },
  contacted: { bg: '#ede9fe', text: '#6d28d9' },
  interested: { bg: '#dcfce7', text: '#15803d' },
  trial_scheduled: { bg: '#fef3c7', text: '#b45309' },
  test_completed: { bg: '#dbeafe', text: '#1d4ed8' },
  enrolled: { bg: '#ccfbf1', text: '#0f766e' },
  lost: { bg: '#fee2e2', text: '#b91c1c' },
  no_response: { bg: '#e5e7eb', text: '#4b5563' },
}

export function formatDateTime(value?: string | null) {
  if (!value) return '—'
  return new Date(value).toLocaleString('fr-FR', {
    dateStyle: 'short',
    timeStyle: 'short',
  })
}

export function toDateTimeLocalValue(value?: string | null) {
  if (!value) return ''
  const date = new Date(value)
  const offset = date.getTimezoneOffset()
  const local = new Date(date.getTime() - offset * 60_000)
  return local.toISOString().slice(0, 16)
}
