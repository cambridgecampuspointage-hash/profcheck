CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.is_reception()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = auth.uid() AND role = 'reception'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TABLE IF NOT EXISTS public.schedule_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campus_id UUID NOT NULL REFERENCES public.centers(id) ON DELETE CASCADE,
  teacher_id UUID NOT NULL REFERENCES public.teachers(id) ON DELETE CASCADE,
  room_id UUID REFERENCES public.rooms(id) ON DELETE SET NULL,
  day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 5),
  start_time TIME NOT NULL,
  duration_minutes INTEGER NOT NULL CHECK (duration_minutes IN (60, 90, 120, 180)),
  session_type TEXT NOT NULL CHECK (session_type IN ('group', 'one_to_one')),
  group_label TEXT,
  audience TEXT CHECK (audience IN ('kids', 'teens', 'adults')),
  subject TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.planned_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID REFERENCES public.schedule_templates(id) ON DELETE SET NULL,
  campus_id UUID NOT NULL REFERENCES public.centers(id) ON DELETE CASCADE,
  teacher_id UUID NOT NULL REFERENCES public.teachers(id) ON DELETE CASCADE,
  room_id UUID REFERENCES public.rooms(id) ON DELETE SET NULL,
  scheduled_date DATE NOT NULL,
  start_time TIME NOT NULL,
  duration_minutes INTEGER NOT NULL CHECK (duration_minutes IN (60, 90, 120, 180)),
  session_type TEXT NOT NULL CHECK (session_type IN ('group', 'one_to_one')),
  group_label TEXT,
  audience TEXT CHECK (audience IN ('kids', 'teens', 'adults')),
  subject TEXT,
  status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'in_progress', 'completed', 'absent', 'cancelled')),
  is_override BOOLEAN NOT NULL DEFAULT FALSE,
  override_reason TEXT,
  linked_session_id UUID REFERENCES public.attendance_sessions(id) ON DELETE SET NULL,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS planned_sessions_scheduled_date_teacher_id_idx
  ON public.planned_sessions(scheduled_date, teacher_id);

CREATE INDEX IF NOT EXISTS planned_sessions_template_id_idx
  ON public.planned_sessions(template_id);

CREATE UNIQUE INDEX IF NOT EXISTS planned_sessions_unique_template_slot_idx
  ON public.planned_sessions(template_id, scheduled_date)
  WHERE template_id IS NOT NULL;

DROP TRIGGER IF EXISTS set_schedule_templates_updated_at ON public.schedule_templates;
CREATE TRIGGER set_schedule_templates_updated_at
  BEFORE UPDATE ON public.schedule_templates
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_planned_sessions_updated_at ON public.planned_sessions;
CREATE TRIGGER set_planned_sessions_updated_at
  BEFORE UPDATE ON public.planned_sessions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.schedule_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.planned_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can manage schedule templates" ON public.schedule_templates;
CREATE POLICY "Admins can manage schedule templates" ON public.schedule_templates
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Teachers can view own schedule templates" ON public.schedule_templates;
CREATE POLICY "Teachers can view own schedule templates" ON public.schedule_templates
  FOR SELECT USING (
    teacher_id IN (SELECT id FROM public.teachers WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS "Reception can view schedule templates" ON public.schedule_templates;
CREATE POLICY "Reception can view schedule templates" ON public.schedule_templates
  FOR SELECT USING (public.is_reception());

DROP POLICY IF EXISTS "Admins can manage planned sessions" ON public.planned_sessions;
CREATE POLICY "Admins can manage planned sessions" ON public.planned_sessions
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Teachers can view own planned sessions" ON public.planned_sessions;
CREATE POLICY "Teachers can view own planned sessions" ON public.planned_sessions
  FOR SELECT USING (
    teacher_id IN (SELECT id FROM public.teachers WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS "Reception can view planned sessions" ON public.planned_sessions;
CREATE POLICY "Reception can view planned sessions" ON public.planned_sessions
  FOR SELECT USING (public.is_reception());

CREATE OR REPLACE FUNCTION public.generate_week_sessions(week_start DATE)
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
  template_record public.schedule_templates%ROWTYPE;
  target_date DATE;
  created_count INTEGER := 0;
BEGIN
  IF EXTRACT(ISODOW FROM week_start) <> 1 THEN
    RAISE EXCEPTION 'week_start doit être un lundi';
  END IF;

  FOR template_record IN
    SELECT *
    FROM public.schedule_templates
    WHERE is_active = TRUE
  LOOP
    target_date := week_start + template_record.day_of_week;

    IF NOT EXISTS (
      SELECT 1
      FROM public.planned_sessions
      WHERE
        scheduled_date = target_date
        AND (
          (template_id IS NOT NULL AND template_id = template_record.id)
          OR (
            teacher_id = template_record.teacher_id
            AND start_time = template_record.start_time
            AND COALESCE(room_id, '00000000-0000-0000-0000-000000000000'::uuid)
              = COALESCE(template_record.room_id, '00000000-0000-0000-0000-000000000000'::uuid)
          )
        )
    ) THEN
      INSERT INTO public.planned_sessions (
        template_id,
        campus_id,
        teacher_id,
        room_id,
        scheduled_date,
        start_time,
        duration_minutes,
        session_type,
        group_label,
        audience,
        subject,
        status,
        created_by
      )
      VALUES (
        template_record.id,
        template_record.campus_id,
        template_record.teacher_id,
        template_record.room_id,
        target_date,
        template_record.start_time,
        template_record.duration_minutes,
        template_record.session_type,
        template_record.group_label,
        template_record.audience,
        template_record.subject,
        'scheduled',
        auth.uid()
      );

      created_count := created_count + 1;
    END IF;
  END LOOP;

  RETURN created_count;
END;
$$;
