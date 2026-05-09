CREATE TABLE IF NOT EXISTS public.student_payment_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  paid_at DATE NOT NULL DEFAULT CURRENT_DATE,
  amount NUMERIC(10,2),
  period_months INTEGER NOT NULL DEFAULT 3 CHECK (period_months BETWEEN 1 AND 12),
  next_due_date DATE NOT NULL,
  notes TEXT,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS student_payment_records_student_id_idx
  ON public.student_payment_records(student_id);

CREATE INDEX IF NOT EXISTS student_payment_records_paid_at_idx
  ON public.student_payment_records(paid_at DESC);

ALTER TABLE public.student_payment_records ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can manage student payment records" ON public.student_payment_records;
CREATE POLICY "Admins can manage student payment records" ON public.student_payment_records
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());
