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

CREATE TABLE IF NOT EXISTS public.staff_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'reception' CHECK (role = 'reception'),
  expected_start TIME NOT NULL,
  expected_end TIME NOT NULL,
  max_break_minutes INTEGER NOT NULL DEFAULT 60 CHECK (max_break_minutes > 0),
  work_days INTEGER[] NOT NULL DEFAULT ARRAY[0, 1, 2, 3, 4, 5],
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (expected_end > expected_start)
);

CREATE TABLE IF NOT EXISTS public.staff_attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  clock_in TIMESTAMPTZ,
  clock_out TIMESTAMPTZ,
  signature_data_url TEXT,
  break_start TIMESTAMPTZ,
  break_end TIMESTAMPTZ,
  late_minutes INTEGER NOT NULL DEFAULT 0,
  early_leave_minutes INTEGER NOT NULL DEFAULT 0,
  break_overtime_minutes INTEGER NOT NULL DEFAULT 0,
  total_present_minutes INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'planned' CHECK (
    status IN ('planned', 'present', 'late', 'on_break', 'completed', 'absent', 'partial')
  ),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, date)
);

CREATE INDEX IF NOT EXISTS staff_schedules_user_id_idx
  ON public.staff_schedules(user_id);

CREATE INDEX IF NOT EXISTS staff_attendance_user_id_date_idx
  ON public.staff_attendance(user_id, date);

DROP TRIGGER IF EXISTS set_staff_schedules_updated_at ON public.staff_schedules;
CREATE TRIGGER set_staff_schedules_updated_at
  BEFORE UPDATE ON public.staff_schedules
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_staff_attendance_updated_at ON public.staff_attendance;
CREATE TRIGGER set_staff_attendance_updated_at
  BEFORE UPDATE ON public.staff_attendance
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.staff_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_attendance ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can manage staff schedules" ON public.staff_schedules;
CREATE POLICY "Admins can manage staff schedules" ON public.staff_schedules
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Reception can view own staff schedules" ON public.staff_schedules;
CREATE POLICY "Reception can view own staff schedules" ON public.staff_schedules
  FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Admins can manage staff attendance" ON public.staff_attendance;
CREATE POLICY "Admins can manage staff attendance" ON public.staff_attendance
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Reception can view own staff attendance" ON public.staff_attendance;
CREATE POLICY "Reception can view own staff attendance" ON public.staff_attendance
  FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Reception can create own staff attendance" ON public.staff_attendance;
CREATE POLICY "Reception can create own staff attendance" ON public.staff_attendance
  FOR INSERT WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Reception can update own staff attendance" ON public.staff_attendance;
CREATE POLICY "Reception can update own staff attendance" ON public.staff_attendance
  FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

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
      'daily_summary'
    )
  );
