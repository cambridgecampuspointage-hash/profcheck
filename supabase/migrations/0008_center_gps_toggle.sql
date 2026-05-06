ALTER TABLE public.centers
  ADD COLUMN IF NOT EXISTS gps_verification_enabled BOOLEAN NOT NULL DEFAULT true;
