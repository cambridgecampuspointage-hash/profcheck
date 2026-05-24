import type { SupabaseClient } from '@supabase/supabase-js'
import type { CrmActivityType } from '@/lib/types'

type ActivityPayload = {
  lead_id?: string | null
  student_id?: string | null
  actor_id?: string | null
  activity_type: CrmActivityType
  title: string
  detail?: string | null
  metadata?: Record<string, unknown>
}

export async function logCrmActivity(
  supabase: SupabaseClient,
  payload: ActivityPayload,
) {
  const { error } = await supabase
    .from('crm_activities')
    .insert({
      lead_id: payload.lead_id || null,
      student_id: payload.student_id || null,
      actor_id: payload.actor_id || null,
      activity_type: payload.activity_type,
      title: payload.title,
      detail: payload.detail || null,
      metadata: payload.metadata || {},
    })

  if (error) {
    console.error('[crm] activity log failed:', error.message)
  }
}
