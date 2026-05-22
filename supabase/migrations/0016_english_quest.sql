ALTER TABLE public.crm_leads
  DROP CONSTRAINT IF EXISTS crm_leads_status_check;

ALTER TABLE public.crm_leads
  ADD CONSTRAINT crm_leads_status_check
  CHECK (
    status IN ('new', 'contacted', 'interested', 'trial_scheduled', 'test_completed', 'enrolled', 'lost', 'no_response')
  );

ALTER TABLE public.crm_leads
  ADD COLUMN IF NOT EXISTS audience TEXT CHECK (audience IS NULL OR audience IN ('junior', 'adult')),
  ADD COLUMN IF NOT EXISTS placement_test_completed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS placement_test_score INTEGER CHECK (placement_test_score IS NULL OR placement_test_score >= 0),
  ADD COLUMN IF NOT EXISTS placement_test_total_questions INTEGER CHECK (placement_test_total_questions IS NULL OR placement_test_total_questions >= 0),
  ADD COLUMN IF NOT EXISTS placement_test_xp INTEGER CHECK (placement_test_xp IS NULL OR placement_test_xp >= 0),
  ADD COLUMN IF NOT EXISTS placement_test_badge TEXT,
  ADD COLUMN IF NOT EXISTS placement_test_level TEXT,
  ADD COLUMN IF NOT EXISTS placement_test_recommended_class TEXT;

CREATE TABLE IF NOT EXISTS public.placement_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  language_code TEXT NOT NULL DEFAULT 'english',
  mission_order INTEGER NOT NULL CHECK (mission_order >= 1),
  question_order INTEGER NOT NULL CHECK (question_order >= 1),
  mission_title TEXT NOT NULL,
  mission_icon TEXT NOT NULL DEFAULT '🎯',
  prompt TEXT NOT NULL,
  context_text TEXT,
  option_a TEXT NOT NULL,
  option_b TEXT NOT NULL,
  option_c TEXT NOT NULL,
  option_d TEXT NOT NULL,
  correct_option TEXT NOT NULL CHECK (correct_option IN ('A', 'B', 'C', 'D')),
  cefr_level TEXT NOT NULL,
  xp_points INTEGER NOT NULL DEFAULT 10 CHECK (xp_points >= 0),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS placement_questions_language_order_unique_idx
  ON public.placement_questions(language_code, mission_order, question_order);

CREATE INDEX IF NOT EXISTS placement_questions_language_active_idx
  ON public.placement_questions(language_code, is_active, mission_order, question_order);

CREATE TABLE IF NOT EXISTS public.placement_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID REFERENCES public.crm_leads(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  contact_phone TEXT NOT NULL,
  age INTEGER CHECK (age IS NULL OR age BETWEEN 3 AND 99),
  audience TEXT NOT NULL CHECK (audience IN ('junior', 'adult')),
  language_code TEXT NOT NULL DEFAULT 'english',
  status TEXT NOT NULL DEFAULT 'started' CHECK (status IN ('started', 'completed', 'abandoned')),
  total_questions INTEGER NOT NULL DEFAULT 0 CHECK (total_questions >= 0),
  answered_questions INTEGER NOT NULL DEFAULT 0 CHECK (answered_questions >= 0),
  correct_answers INTEGER NOT NULL DEFAULT 0 CHECK (correct_answers >= 0),
  raw_score INTEGER NOT NULL DEFAULT 0 CHECK (raw_score >= 0),
  xp_score INTEGER NOT NULL DEFAULT 0 CHECK (xp_score >= 0),
  current_streak INTEGER NOT NULL DEFAULT 0 CHECK (current_streak >= 0),
  best_streak INTEGER NOT NULL DEFAULT 0 CHECK (best_streak >= 0),
  badge TEXT,
  estimated_level TEXT,
  recommended_class TEXT,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS placement_attempts_lead_id_idx
  ON public.placement_attempts(lead_id);

CREATE INDEX IF NOT EXISTS placement_attempts_status_idx
  ON public.placement_attempts(status, created_at DESC);

CREATE TABLE IF NOT EXISTS public.placement_answers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  attempt_id UUID NOT NULL REFERENCES public.placement_attempts(id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES public.placement_questions(id) ON DELETE CASCADE,
  selected_option TEXT NOT NULL CHECK (selected_option IN ('A', 'B', 'C', 'D')),
  is_correct BOOLEAN NOT NULL,
  answered_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS placement_answers_attempt_question_unique_idx
  ON public.placement_answers(attempt_id, question_id);

CREATE INDEX IF NOT EXISTS placement_answers_attempt_idx
  ON public.placement_answers(attempt_id, answered_at);

ALTER TABLE public.placement_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.placement_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.placement_answers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can read active placement questions" ON public.placement_questions;
CREATE POLICY "Public can read active placement questions" ON public.placement_questions
  FOR SELECT USING (is_active = true);

DROP POLICY IF EXISTS "Admins can manage placement questions" ON public.placement_questions;
CREATE POLICY "Admins can manage placement questions" ON public.placement_questions
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admins can manage placement attempts" ON public.placement_attempts;
CREATE POLICY "Admins can manage placement attempts" ON public.placement_attempts
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admins can manage placement answers" ON public.placement_answers;
CREATE POLICY "Admins can manage placement answers" ON public.placement_answers
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP TRIGGER IF EXISTS set_placement_attempts_updated_at ON public.placement_attempts;
CREATE TRIGGER set_placement_attempts_updated_at
  BEFORE UPDATE ON public.placement_attempts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.placement_questions (
  language_code,
  mission_order,
  question_order,
  mission_title,
  mission_icon,
  prompt,
  context_text,
  option_a,
  option_b,
  option_c,
  option_d,
  correct_option,
  cefr_level,
  xp_points
)
VALUES
  ('english', 1, 1, 'Meet New Friends', '👋', 'Sarah says: "Hi! My name ___ Sarah."', 'Choose the best answer to continue the conversation.', 'am', 'is', 'are', 'be', 'B', 'A1', 10),
  ('english', 1, 2, 'Meet New Friends', '👋', 'Tom and Lisa ___ from Rabat.', 'Help them finish the sentence.', 'is', 'am', 'are', 'be', 'C', 'A1', 10),
  ('english', 1, 3, 'Meet New Friends', '👋', 'We ___ English every Saturday.', 'Choose the most natural option.', 'study', 'studies', 'studying', 'studied', 'A', 'A1', 10),
  ('english', 1, 4, 'Meet New Friends', '👋', 'Maya has got two ___ in her school bag.', 'Pick the right plural noun.', 'book', 'books', 'books''', 'bookes', 'B', 'A1', 10),
  ('english', 1, 5, 'Meet New Friends', '👋', 'Can you ___ me your phone number, please?', 'What fits best in this friendly exchange?', 'say', 'speak', 'tell', 'talk', 'C', 'A1', 10),

  ('english', 2, 1, 'A Day in the City', '🏙️', 'Yesterday, Adam ___ to the cinema with his friends.', 'Choose the best form for a past event.', 'go', 'goes', 'went', 'gone', 'C', 'A2', 10),
  ('english', 2, 2, 'A Day in the City', '🏙️', 'There isn''t ___ milk in the fridge.', 'Help complete the shopping conversation.', 'many', 'some', 'any', 'a few', 'C', 'A2', 10),
  ('english', 2, 3, 'A Day in the City', '🏙️', 'If it rains, we ___ the museum instead.', 'Choose the best future plan.', 'visit', 'visited', 'will visit', 'would visit', 'C', 'A2', 10),
  ('english', 2, 4, 'A Day in the City', '🏙️', 'This café is ___ than the one near the station.', 'Compare the two places.', 'cheap', 'cheaper', 'cheapest', 'more cheap', 'B', 'A2', 10),
  ('english', 2, 5, 'A Day in the City', '🏙️', 'How often do you ___ the bus to school?', 'Pick the verb that sounds natural.', 'take', 'takes', 'took', 'taking', 'A', 'A2', 10),

  ('english', 3, 1, 'School and Hobbies', '🎒', 'The teacher asked me where I ___.', 'Choose the correct reported statement.', 'live', 'lived', 'am living', 'have lived', 'B', 'B1', 10),
  ('english', 3, 2, 'School and Hobbies', '🎒', 'I''ve played tennis ___ I was eight years old.', 'Complete the sentence about duration.', 'for', 'since', 'from', 'during', 'B', 'B1', 10),
  ('english', 3, 3, 'School and Hobbies', '🎒', 'You won''t improve your English unless you ___ regularly.', 'Choose the best verb form.', 'practice', 'practiced', 'will practice', 'are practicing', 'A', 'B1', 10),
  ('english', 3, 4, 'School and Hobbies', '🎒', 'The film was so funny that everyone ___ laughing.', 'Which verb fits best here?', 'broke into', 'put off', 'gave up', 'looked after', 'A', 'B1', 10),
  ('english', 3, 5, 'School and Hobbies', '🎒', 'If I ___ more free time, I''d join the drama club.', 'Choose the correct conditional form.', 'have', 'had', 'will have', 'would have', 'B', 'B1', 10),

  ('english', 4, 1, 'Travel Challenge', '✈️', 'By the time we arrived, the train ___.', 'Choose the best past perfect form.', 'left', 'has left', 'had left', 'was leaving', 'C', 'B2', 10),
  ('english', 4, 2, 'Travel Challenge', '✈️', 'The guide recommended ___ tickets in advance.', 'What should the traveler do?', 'book', 'to book', 'booking', 'booked', 'C', 'B2', 10),
  ('english', 4, 3, 'Travel Challenge', '✈️', 'Not only ___ the museum fascinating, but it was also free.', 'Choose the correct inverted form.', 'was', 'it was', 'did it', 'had it', 'A', 'B2', 10),
  ('english', 4, 4, 'Travel Challenge', '✈️', 'We would have reached the airport on time if the taxi ___ late.', 'Complete the third conditional.', 'wasn''t', 'hadn''t been', 'wouldn''t be', 'hasn''t been', 'B', 'B2', 10),
  ('english', 4, 5, 'Travel Challenge', '✈️', 'Her luggage, ___ was quite heavy, had to be checked in.', 'Choose the correct relative pronoun.', 'that', 'which', 'what', 'who', 'B', 'B2', 10),

  ('english', 5, 1, 'Final Challenge', '🏆', 'No sooner ___ home than it started raining.', 'Pick the strongest advanced structure.', 'I arrived', 'had I arrived', 'I had arrived', 'have I arrived', 'B', 'C1', 10),
  ('english', 5, 2, 'Final Challenge', '🏆', 'Were the company ___ to expand, it would need more staff.', 'Choose the formal conditional expression.', 'decide', 'deciding', 'to decide', 'decided', 'C', 'C1', 10),
  ('english', 5, 3, 'Final Challenge', '🏆', 'Hardly ever ___ such a convincing presentation.', 'Select the best inversion.', 'I have seen', 'have I seen', 'I had seen', 'had I seen', 'B', 'C1', 10),
  ('english', 5, 4, 'Final Challenge', '🏆', 'The proposal was rejected, not least because it failed to ___ the budget issue.', 'Choose the most natural advanced verb.', 'address', 'announce', 'arrange', 'attend', 'A', 'C1', 10),
  ('english', 5, 5, 'Final Challenge', '🏆', 'Much as I ___ to help, I couldn''t change the decision.', 'Choose the best concessive structure.', 'want', 'wanted', 'had wanted', 'would want', 'B', 'C1', 10)
ON CONFLICT (language_code, mission_order, question_order) DO NOTHING;

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
      'daily_summary',
      'crm_hot_lead',
      'crm_trial_tomorrow',
      'crm_payment_overdue',
      'placement_test_completed'
    )
  );
