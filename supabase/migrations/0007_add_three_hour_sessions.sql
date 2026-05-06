ALTER TABLE public.schedule_templates
  DROP CONSTRAINT IF EXISTS schedule_templates_duration_minutes_check;

ALTER TABLE public.schedule_templates
  ADD CONSTRAINT schedule_templates_duration_minutes_check
  CHECK (duration_minutes IN (60, 90, 120, 180));

ALTER TABLE public.planned_sessions
  DROP CONSTRAINT IF EXISTS planned_sessions_duration_minutes_check;

ALTER TABLE public.planned_sessions
  ADD CONSTRAINT planned_sessions_duration_minutes_check
  CHECK (duration_minutes IN (60, 90, 120, 180));
