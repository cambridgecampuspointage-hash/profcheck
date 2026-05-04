-- Enable Row Level Security
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.centers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teachers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.qr_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;

-- Helper function to check if current user is admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 1. Profiles
-- Admin can do anything
CREATE POLICY "Admins can manage profiles" ON public.profiles
  FOR ALL USING (public.is_admin());

-- Users can read their own profile
CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

-- 2. Centers
-- Admins can do anything
CREATE POLICY "Admins can manage centers" ON public.centers
  FOR ALL USING (public.is_admin());

-- Anyone authenticated can read centers
CREATE POLICY "Anyone can view centers" ON public.centers
  FOR SELECT USING (auth.role() = 'authenticated');

-- 3. Rooms
CREATE POLICY "Admins can manage rooms" ON public.rooms
  FOR ALL USING (public.is_admin());

CREATE POLICY "Anyone can view rooms" ON public.rooms
  FOR SELECT USING (auth.role() = 'authenticated');

-- 4. Teachers
CREATE POLICY "Admins can manage teachers" ON public.teachers
  FOR ALL USING (public.is_admin());

-- Teachers can view their own teacher profile
CREATE POLICY "Teachers can view own teacher record" ON public.teachers
  FOR SELECT USING (user_id = auth.uid());

-- 5. QR Tokens
-- Only Admins/Server can manage (service_role bypasses RLS anyway)
CREATE POLICY "Admins can manage qr_tokens" ON public.qr_tokens
  FOR ALL USING (public.is_admin());

-- 6. Attendance Sessions
CREATE POLICY "Admins can manage attendance_sessions" ON public.attendance_sessions
  FOR ALL USING (public.is_admin());

-- Teachers can view their own sessions
CREATE POLICY "Teachers can view own sessions" ON public.attendance_sessions
  FOR SELECT USING (
    teacher_id IN (SELECT id FROM public.teachers WHERE user_id = auth.uid())
  );

-- Note: Insert/Update for attendance_sessions should be done via secure server actions (service_role)
-- So we do not grant INSERT/UPDATE to teachers directly via RLS.

-- 7. Attendance Attempts
CREATE POLICY "Admins can manage attendance_attempts" ON public.attendance_attempts
  FOR ALL USING (public.is_admin());

-- Teachers can view their own attempts
CREATE POLICY "Teachers can view own attempts" ON public.attendance_attempts
  FOR SELECT USING (
    teacher_id IN (SELECT id FROM public.teachers WHERE user_id = auth.uid())
  );

-- 8. Courses
CREATE POLICY "Admins can manage courses" ON public.courses
  FOR ALL USING (public.is_admin());

CREATE POLICY "Teachers can view own courses" ON public.courses
  FOR SELECT USING (
    teacher_id IN (SELECT id FROM public.teachers WHERE user_id = auth.uid())
  );
