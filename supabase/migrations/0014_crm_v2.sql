ALTER TABLE public.crm_leads
  ADD COLUMN IF NOT EXISTS trial_date TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS crm_leads_trial_date_idx
  ON public.crm_leads(trial_date);

CREATE TABLE IF NOT EXISTS public.crm_message_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  message_type TEXT NOT NULL CHECK (
    message_type IN ('first_contact', 'follow_up', 'trial_invite', 'trial_reminder')
  ),
  message_body TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS crm_message_templates_name_unique_idx
  ON public.crm_message_templates(name);

CREATE INDEX IF NOT EXISTS crm_message_templates_type_idx
  ON public.crm_message_templates(message_type, is_active);

ALTER TABLE public.crm_message_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can manage crm message templates" ON public.crm_message_templates;
CREATE POLICY "Admins can manage crm message templates" ON public.crm_message_templates
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP TRIGGER IF EXISTS set_crm_message_templates_updated_at ON public.crm_message_templates;
CREATE TRIGGER set_crm_message_templates_updated_at
  BEFORE UPDATE ON public.crm_message_templates
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.crm_message_templates (name, message_type, message_body)
VALUES
  (
    'Premier contact Cambridge',
    'first_contact',
    'Bonjour {{parent_name}}, ici Cambridge Campus. Merci pour votre intérêt pour nos cours de {{program_interest}} pour {{student_name}}. Souhaitez-vous que nous vous proposions un créneau de test de niveau cette semaine ?'
  ),
  (
    'Relance sans réponse',
    'follow_up',
    'Bonjour {{parent_name}}, je reviens vers vous concernant la demande de {{program_interest}} pour {{student_name}}. Nous avons encore des créneaux disponibles. Souhaitez-vous que je vous appelle ou que je vous propose un test ?'
  ),
  (
    'Invitation test de niveau',
    'trial_invite',
    'Bonjour {{parent_name}}, nous pouvons planifier le test de niveau de {{student_name}}. Êtes-vous disponible {{availability}} ?'
  ),
  (
    'Rappel test prévu',
    'trial_reminder',
    'Bonjour {{parent_name}}, petit rappel pour le test prévu de {{student_name}} chez Cambridge Campus. N’hésitez pas à nous écrire si vous souhaitez confirmer ou décaler le rendez-vous.'
  )
ON CONFLICT (name) DO NOTHING;
