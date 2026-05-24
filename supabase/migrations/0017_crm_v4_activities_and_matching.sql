ALTER TABLE public.crm_leads
  ADD COLUMN IF NOT EXISTS recommended_class_id UUID REFERENCES public.student_classes(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS crm_leads_recommended_class_id_idx
  ON public.crm_leads(recommended_class_id);

CREATE TABLE IF NOT EXISTS public.crm_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID REFERENCES public.crm_leads(id) ON DELETE CASCADE,
  student_id UUID REFERENCES public.students(id) ON DELETE CASCADE,
  actor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  activity_type TEXT NOT NULL CHECK (
    activity_type IN (
      'call',
      'whatsapp',
      'note',
      'test_completed',
      'trial_scheduled',
      'payment_followup',
      'status_change',
      'enrollment',
      'telegram_alert',
      'follow_up_reminder',
      'class_recommendation'
    )
  ),
  title TEXT NOT NULL,
  detail TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (lead_id IS NOT NULL OR student_id IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS crm_activities_lead_id_created_at_idx
  ON public.crm_activities(lead_id, created_at DESC);

CREATE INDEX IF NOT EXISTS crm_activities_student_id_created_at_idx
  ON public.crm_activities(student_id, created_at DESC);

CREATE INDEX IF NOT EXISTS crm_activities_type_created_at_idx
  ON public.crm_activities(activity_type, created_at DESC);

ALTER TABLE public.crm_activities ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can manage crm activities" ON public.crm_activities;
CREATE POLICY "Admins can manage crm activities" ON public.crm_activities
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());
