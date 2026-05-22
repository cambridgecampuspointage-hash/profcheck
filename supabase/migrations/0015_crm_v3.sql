CREATE TABLE IF NOT EXISTS public.crm_lead_scores (
  lead_id UUID PRIMARY KEY REFERENCES public.crm_leads(id) ON DELETE CASCADE,
  score INTEGER NOT NULL DEFAULT 0,
  temperature TEXT NOT NULL DEFAULT 'cold' CHECK (temperature IN ('hot', 'warm', 'cold')),
  score_factors JSONB NOT NULL DEFAULT '[]'::jsonb,
  scored_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS crm_lead_scores_temperature_idx
  ON public.crm_lead_scores(temperature, score DESC);

CREATE TABLE IF NOT EXISTS public.crm_payment_followups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  lead_id UUID REFERENCES public.crm_leads(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'overdue' CHECK (status IN ('overdue', 'promised', 'resolved', 'blocked')),
  amount_due NUMERIC(10,2),
  promised_payment_date DATE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS crm_payment_followups_student_active_unique_idx
  ON public.crm_payment_followups(student_id)
  WHERE status IN ('overdue', 'promised', 'blocked');

CREATE INDEX IF NOT EXISTS crm_payment_followups_status_idx
  ON public.crm_payment_followups(status, updated_at DESC);

ALTER TABLE public.crm_lead_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_payment_followups ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can manage crm lead scores" ON public.crm_lead_scores;
CREATE POLICY "Admins can manage crm lead scores" ON public.crm_lead_scores
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admins can manage crm payment followups" ON public.crm_payment_followups;
CREATE POLICY "Admins can manage crm payment followups" ON public.crm_payment_followups
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP TRIGGER IF EXISTS set_crm_lead_scores_updated_at ON public.crm_lead_scores;
CREATE TRIGGER set_crm_lead_scores_updated_at
  BEFORE UPDATE ON public.crm_lead_scores
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_crm_payment_followups_updated_at ON public.crm_payment_followups;
CREATE TRIGGER set_crm_payment_followups_updated_at
  BEFORE UPDATE ON public.crm_payment_followups
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.telegram_alerts_log
  DROP CONSTRAINT IF EXISTS telegram_alerts_log_alert_type_check;

ALTER TABLE public.telegram_alerts_log
  ADD CONSTRAINT telegram_alerts_log_alert_type_check
  CHECK (
    alert_type IN (
      'teacher_absent',
      'teacher_late',
      'out_of_planning',
      'staff_late',
      'staff_absent',
      'staff_long_break',
      'staff_early_leave',
      'staff_missing_clock_out',
      'daily_summary',
      'crm_hot_lead',
      'crm_trial_tomorrow',
      'crm_payment_overdue'
    )
  );
