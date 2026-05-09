ALTER TABLE public.attendance_sessions
  ADD COLUMN IF NOT EXISTS teacher_notes TEXT;
