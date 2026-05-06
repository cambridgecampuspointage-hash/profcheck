ALTER TABLE public.teachers
  ADD COLUMN IF NOT EXISTS hourly_rate_short NUMERIC NOT NULL DEFAULT 75,
  ADD COLUMN IF NOT EXISTS hourly_rate_long NUMERIC NOT NULL DEFAULT 66.67;

UPDATE public.teachers
SET
  hourly_rate_short = COALESCE(hourly_rate_short, 75),
  hourly_rate_long = COALESCE(hourly_rate_long, 66.67)
WHERE
  hourly_rate_short IS NULL
  OR hourly_rate_long IS NULL;
