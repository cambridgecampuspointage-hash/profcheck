CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS public.telegram_alerts_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_type TEXT NOT NULL CHECK (
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
  ),
  reference_id UUID,
  reference_date DATE NOT NULL DEFAULT CURRENT_DATE,
  recipient_chat_id TEXT NOT NULL,
  message_text TEXT,
  telegram_message_id INT,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sent_ok BOOLEAN NOT NULL DEFAULT TRUE,
  error_message TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS telegram_alerts_log_unique_event_idx
  ON public.telegram_alerts_log(alert_type, reference_id, reference_date);

ALTER TABLE public.telegram_alerts_log ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.telegram_alerts_log FROM anon, authenticated;
