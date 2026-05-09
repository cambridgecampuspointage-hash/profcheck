CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE OR REPLACE FUNCTION public.is_teacher()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.teachers
    WHERE user_id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TABLE IF NOT EXISTS public.student_classes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  center_id UUID NOT NULL REFERENCES public.centers(id) ON DELETE CASCADE,
  teacher_id UUID REFERENCES public.teachers(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  level TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.students (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  center_id UUID REFERENCES public.centers(id) ON DELETE SET NULL,
  full_name TEXT NOT NULL,
  phone TEXT,
  parent_name TEXT,
  parent_phone TEXT,
  email TEXT,
  payment_due_date DATE,
  access_status TEXT NOT NULL DEFAULT 'allowed' CHECK (access_status IN ('allowed', 'blocked')),
  access_block_reason TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.student_class_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id UUID NOT NULL REFERENCES public.student_classes(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (class_id, student_id)
);

ALTER TABLE public.planned_sessions
  ADD COLUMN IF NOT EXISTS class_id UUID REFERENCES public.student_classes(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS public.student_attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  class_id UUID NOT NULL REFERENCES public.student_classes(id) ON DELETE CASCADE,
  planned_session_id UUID REFERENCES public.planned_sessions(id) ON DELETE SET NULL,
  attendance_date DATE NOT NULL DEFAULT CURRENT_DATE,
  status TEXT NOT NULL DEFAULT 'present' CHECK (status IN ('present', 'absent', 'late', 'excused')),
  marked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  marked_by_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  source TEXT NOT NULL DEFAULT 'qr' CHECK (source IN ('qr', 'teacher', 'admin', 'reception')),
  signature_data_url TEXT,
  notes TEXT,
  UNIQUE (student_id, class_id, attendance_date)
);

CREATE TABLE IF NOT EXISTS public.student_checkin_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id UUID NOT NULL REFERENCES public.student_classes(id) ON DELETE CASCADE,
  planned_session_id UUID REFERENCES public.planned_sessions(id) ON DELETE SET NULL,
  token TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS student_classes_center_id_idx
  ON public.student_classes(center_id);

CREATE INDEX IF NOT EXISTS student_classes_teacher_id_idx
  ON public.student_classes(teacher_id);

CREATE INDEX IF NOT EXISTS students_center_id_idx
  ON public.students(center_id);

CREATE INDEX IF NOT EXISTS student_attendance_attendance_date_idx
  ON public.student_attendance(attendance_date);

CREATE INDEX IF NOT EXISTS student_checkin_tokens_class_id_idx
  ON public.student_checkin_tokens(class_id);

DROP TRIGGER IF EXISTS set_student_classes_updated_at ON public.student_classes;
CREATE TRIGGER set_student_classes_updated_at
  BEFORE UPDATE ON public.student_classes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_students_updated_at ON public.students;
CREATE TRIGGER set_students_updated_at
  BEFORE UPDATE ON public.students
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.student_classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_class_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_checkin_tokens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can manage student classes" ON public.student_classes;
CREATE POLICY "Admins can manage student classes" ON public.student_classes
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Teachers can view own student classes" ON public.student_classes;
CREATE POLICY "Teachers can view own student classes" ON public.student_classes
  FOR SELECT USING (
    teacher_id IN (SELECT id FROM public.teachers WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS "Admins can manage students" ON public.students;
CREATE POLICY "Admins can manage students" ON public.students
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Teachers can view students from own classes" ON public.students;
CREATE POLICY "Teachers can view students from own classes" ON public.students
  FOR SELECT USING (
    id IN (
      SELECT scm.student_id
      FROM public.student_class_members scm
      JOIN public.student_classes sc ON sc.id = scm.class_id
      JOIN public.teachers t ON t.id = sc.teacher_id
      WHERE t.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Admins can manage student class members" ON public.student_class_members;
CREATE POLICY "Admins can manage student class members" ON public.student_class_members
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Teachers can view own student class members" ON public.student_class_members;
CREATE POLICY "Teachers can view own student class members" ON public.student_class_members
  FOR SELECT USING (
    class_id IN (
      SELECT sc.id
      FROM public.student_classes sc
      JOIN public.teachers t ON t.id = sc.teacher_id
      WHERE t.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Admins can manage student attendance" ON public.student_attendance;
CREATE POLICY "Admins can manage student attendance" ON public.student_attendance
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Teachers can view own student attendance" ON public.student_attendance;
CREATE POLICY "Teachers can view own student attendance" ON public.student_attendance
  FOR SELECT USING (
    class_id IN (
      SELECT sc.id
      FROM public.student_classes sc
      JOIN public.teachers t ON t.id = sc.teacher_id
      WHERE t.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Admins can manage student checkin tokens" ON public.student_checkin_tokens;
CREATE POLICY "Admins can manage student checkin tokens" ON public.student_checkin_tokens
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

