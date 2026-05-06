ALTER TABLE public.attendance_sessions
  ADD COLUMN IF NOT EXISTS planned_duration_minutes INTEGER,
  ADD COLUMN IF NOT EXISTS session_type TEXT DEFAULT 'standard'
    CHECK (session_type IN ('standard', 'one_to_one')),
  ADD COLUMN IF NOT EXISTS applied_hourly_rate NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS payable_amount NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS signature_data_url TEXT;

UPDATE public.attendance_sessions
SET
  planned_duration_minutes = COALESCE(planned_duration_minutes, duration_minutes),
  session_type = COALESCE(session_type, 'standard'),
  applied_hourly_rate = COALESCE(applied_hourly_rate, 0),
  payable_amount = COALESCE(payable_amount, 0)
WHERE
  planned_duration_minutes IS NULL
  OR session_type IS NULL
  OR applied_hourly_rate IS NULL
  OR payable_amount IS NULL;
