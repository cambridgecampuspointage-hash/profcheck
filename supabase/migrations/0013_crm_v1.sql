CREATE TABLE IF NOT EXISTS public.crm_leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  center_id UUID REFERENCES public.centers(id) ON DELETE SET NULL,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  assigned_to UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  converted_student_id UUID REFERENCES public.students(id) ON DELETE SET NULL,
  parent_name TEXT NOT NULL,
  parent_phone TEXT,
  parent_whatsapp TEXT,
  parent_email TEXT,
  student_name TEXT NOT NULL,
  student_age INTEGER CHECK (student_age IS NULL OR student_age BETWEEN 3 AND 99),
  student_level TEXT,
  program_interest TEXT,
  availability TEXT,
  goal TEXT,
  source TEXT,
  status TEXT NOT NULL DEFAULT 'new' CHECK (
    status IN ('new', 'contacted', 'interested', 'trial_scheduled', 'enrolled', 'lost', 'no_response')
  ),
  next_follow_up_at TIMESTAMPTZ,
  last_contact_at TIMESTAMPTZ,
  lost_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS crm_leads_converted_student_id_unique_idx
  ON public.crm_leads(converted_student_id)
  WHERE converted_student_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS crm_leads_status_idx
  ON public.crm_leads(status);

CREATE INDEX IF NOT EXISTS crm_leads_next_follow_up_at_idx
  ON public.crm_leads(next_follow_up_at);

CREATE INDEX IF NOT EXISTS crm_leads_assigned_to_idx
  ON public.crm_leads(assigned_to);

CREATE INDEX IF NOT EXISTS crm_leads_created_at_idx
  ON public.crm_leads(created_at DESC);

CREATE TABLE IF NOT EXISTS public.crm_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES public.crm_leads(id) ON DELETE CASCADE,
  author_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  note TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS crm_notes_lead_id_idx
  ON public.crm_notes(lead_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.crm_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES public.crm_leads(id) ON DELETE CASCADE,
  assigned_to UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  task_type TEXT NOT NULL DEFAULT 'follow_up' CHECK (
    task_type IN ('follow_up', 'call', 'trial', 'meeting', 'other')
  ),
  title TEXT NOT NULL,
  due_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (
    status IN ('pending', 'completed', 'cancelled')
  ),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS crm_tasks_lead_id_idx
  ON public.crm_tasks(lead_id);

CREATE INDEX IF NOT EXISTS crm_tasks_status_due_at_idx
  ON public.crm_tasks(status, due_at);

CREATE INDEX IF NOT EXISTS crm_tasks_assigned_to_idx
  ON public.crm_tasks(assigned_to);

ALTER TABLE public.crm_leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_tasks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can manage crm leads" ON public.crm_leads;
CREATE POLICY "Admins can manage crm leads" ON public.crm_leads
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admins can manage crm notes" ON public.crm_notes;
CREATE POLICY "Admins can manage crm notes" ON public.crm_notes
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admins can manage crm tasks" ON public.crm_tasks;
CREATE POLICY "Admins can manage crm tasks" ON public.crm_tasks
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP TRIGGER IF EXISTS set_crm_leads_updated_at ON public.crm_leads;
CREATE TRIGGER set_crm_leads_updated_at
  BEFORE UPDATE ON public.crm_leads
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_crm_tasks_updated_at ON public.crm_tasks;
CREATE TRIGGER set_crm_tasks_updated_at
  BEFORE UPDATE ON public.crm_tasks
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
