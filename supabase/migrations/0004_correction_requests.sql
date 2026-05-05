CREATE TABLE public.attendance_correction_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  teacher_id UUID NOT NULL REFERENCES public.teachers(id) ON DELETE CASCADE,
  session_id UUID REFERENCES public.attendance_sessions(id) ON DELETE SET NULL,
  request_type TEXT NOT NULL CHECK (
    request_type IN ('missed_start', 'missed_end', 'gps_issue', 'other')
  ),
  requested_start_at TIMESTAMPTZ,
  requested_end_at TIMESTAMPTZ,
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (
    status IN ('pending', 'approved', 'rejected')
  ),
  admin_notes TEXT,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX attendance_correction_requests_teacher_id_idx
  ON public.attendance_correction_requests(teacher_id);

CREATE INDEX attendance_correction_requests_status_idx
  ON public.attendance_correction_requests(status);

ALTER TABLE public.attendance_correction_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage correction requests" ON public.attendance_correction_requests
  FOR ALL USING (public.is_admin());

CREATE POLICY "Teachers can view own correction requests" ON public.attendance_correction_requests
  FOR SELECT USING (
    teacher_id IN (SELECT id FROM public.teachers WHERE user_id = auth.uid())
  );

CREATE POLICY "Teachers can create own correction requests" ON public.attendance_correction_requests
  FOR INSERT WITH CHECK (
    teacher_id IN (SELECT id FROM public.teachers WHERE user_id = auth.uid())
  );
