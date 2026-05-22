import { createAdminClient } from '@/lib/supabase/admin'
import { evaluatePlacementAttempt } from '@/lib/placement/quest'
import type { PlacementAttempt, PlacementQuestion, PlacementQuestionPublic } from '@/lib/types'
import { buildPlacementTestCompletedMessage } from '@/lib/telegram/alertMessages'
import { logAlertToSupabase, sendTelegramMessage } from '@/lib/telegram/sendAlert'

type QuestAudience = 'junior' | 'adult'
type PlacementOption = 'A' | 'B' | 'C' | 'D'

function normalizePhone(value: string) {
  return value.trim().replace(/\s+/g, ' ')
}

function normalizeName(value: string) {
  return value.trim().replace(/\s+/g, ' ')
}

function normalizeComparableName(value: string) {
  return normalizeName(value).toLowerCase()
}

async function getActiveEnglishQuestions() {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('placement_questions')
    .select('*')
    .eq('language_code', 'english')
    .eq('is_active', true)
    .order('mission_order')
    .order('question_order')

  if (error) {
    throw new Error(error.message)
  }

  return (data || []) as PlacementQuestion[]
}

export async function getPublicEnglishQuestQuestions(): Promise<PlacementQuestionPublic[]> {
  const questions = await getActiveEnglishQuestions()
  return questions.map((question) => ({
    id: question.id,
    language_code: question.language_code,
    mission_order: question.mission_order,
    question_order: question.question_order,
    mission_title: question.mission_title,
    mission_icon: question.mission_icon,
    prompt: question.prompt,
    context_text: question.context_text,
    option_a: question.option_a,
    option_b: question.option_b,
    option_c: question.option_c,
    option_d: question.option_d,
    cefr_level: question.cefr_level,
    xp_points: question.xp_points,
    is_active: question.is_active,
  }))
}

export async function startEnglishQuest(payload: {
  fullName: string
  phone: string
  age?: number | null
  audience: QuestAudience
}) {
  const fullName = normalizeName(payload.fullName)
  const phone = normalizePhone(payload.phone)

  if (!fullName) {
    return { error: 'Le nom complet est obligatoire.' as const }
  }

  if (!phone) {
    return { error: 'Le téléphone ou WhatsApp est obligatoire.' as const }
  }

  const questions = await getActiveEnglishQuestions()
  if (questions.length === 0) {
    return { error: 'Aucune question de test n’est configurée.' as const }
  }

  const admin = createAdminClient()
  const now = new Date().toISOString()

  const { data: existingAttempts, error: existingAttemptsError } = await admin
    .from('placement_attempts')
    .select('*')
    .eq('status', 'completed')
    .eq('contact_phone', phone)
    .order('completed_at', { ascending: false })

  if (existingAttemptsError) {
    return { error: existingAttemptsError.message }
  }

  const existingAttempt = ((existingAttempts || []) as PlacementAttempt[]).find((attempt) => {
    return normalizeComparableName(attempt.full_name) === normalizeComparableName(fullName)
  })

  if (existingAttempt && existingAttempt.badge && existingAttempt.estimated_level && existingAttempt.recommended_class) {
    return {
      success: true as const,
      existingAttempt: true as const,
      leadId: existingAttempt.lead_id,
      attemptId: existingAttempt.id,
      totalQuestions: existingAttempt.total_questions,
      result: {
        score: existingAttempt.raw_score,
        xp: existingAttempt.xp_score,
        badge: existingAttempt.badge,
        estimatedLevel: existingAttempt.estimated_level,
        recommendedClass: existingAttempt.recommended_class,
        bestStreak: existingAttempt.best_streak,
        completedAt: existingAttempt.completed_at,
        summary: `You already completed Cambridge English Quest. Your certificate is ready to download.`,
      },
    }
  }

  const { data: lead, error: leadError } = await admin
    .from('crm_leads')
    .insert({
      parent_name: fullName,
      parent_phone: phone,
      parent_whatsapp: phone,
      audience: payload.audience,
      student_name: fullName,
      student_age: payload.age ?? null,
      goal: 'Cambridge English Quest',
      source: 'english_quest',
      status: 'new',
      program_interest: payload.audience === 'junior' ? 'Junior English Quest' : 'Adult English Quest',
      last_contact_at: now,
    })
    .select('id')
    .single()

  if (leadError || !lead) {
    return { error: leadError?.message || 'Impossible de créer la fiche prospect.' as const }
  }

  const { data: attempt, error: attemptError } = await admin
    .from('placement_attempts')
    .insert({
      lead_id: lead.id,
      full_name: fullName,
      contact_phone: phone,
      age: payload.age ?? null,
      audience: payload.audience,
      total_questions: questions.length,
    })
    .select('*')
    .single()

  if (attemptError || !attempt) {
    return { error: attemptError?.message || 'Impossible de démarrer le test.' as const }
  }

  return {
    success: true as const,
    existingAttempt: false as const,
    leadId: lead.id,
    attemptId: attempt.id,
    totalQuestions: questions.length,
  }
}

export async function recordEnglishQuestAnswer(payload: {
  attemptId: string
  questionId: string
  selectedOption: PlacementOption
}) {
  const admin = createAdminClient()
  const [{ data: attempt, error: attemptError }, questions] = await Promise.all([
    admin
      .from('placement_attempts')
      .select('*')
      .eq('id', payload.attemptId)
      .maybeSingle(),
    getActiveEnglishQuestions(),
  ])

  if (attemptError || !attempt) {
    return { error: 'Tentative introuvable.' as const }
  }

  if ((attempt as PlacementAttempt).status !== 'started') {
    return { error: 'Cette tentative n’accepte plus de réponses.' as const }
  }

  const question = questions.find((entry) => entry.id === payload.questionId)
  if (!question) {
    return { error: 'Question introuvable.' as const }
  }

  const isCorrect = question.correct_option === payload.selectedOption

  const { error: answerError } = await admin
    .from('placement_answers')
    .upsert({
      attempt_id: payload.attemptId,
      question_id: payload.questionId,
      selected_option: payload.selectedOption,
      is_correct: isCorrect,
      answered_at: new Date().toISOString(),
    }, {
      onConflict: 'attempt_id,question_id',
    })

  if (answerError) {
    return { error: answerError.message }
  }

  const { data: answers, error: answersError } = await admin
    .from('placement_answers')
    .select('question_id, selected_option')
    .eq('attempt_id', payload.attemptId)

  if (answersError) {
    return { error: answersError.message }
  }

  const evaluation = evaluatePlacementAttempt({
    questions,
    answers: (answers || []) as Array<{ question_id: string; selected_option: PlacementOption }>,
  })

  const { error: updateError } = await admin
    .from('placement_attempts')
    .update({
      answered_questions: evaluation.answeredQuestions,
      correct_answers: evaluation.correctAnswers,
      raw_score: evaluation.rawScore,
      xp_score: evaluation.xpScore,
      current_streak: evaluation.currentStreak,
      best_streak: evaluation.bestStreak,
    })
    .eq('id', payload.attemptId)

  if (updateError) {
    return { error: updateError.message }
  }

  return {
    success: true as const,
    correct: isCorrect,
    xpScore: evaluation.xpScore,
    currentStreak: evaluation.currentStreak,
    bestStreak: evaluation.bestStreak,
    answeredQuestions: evaluation.answeredQuestions,
    totalQuestions: evaluation.totalQuestions,
  }
}

export async function completeEnglishQuest(attemptId: string) {
  const admin = createAdminClient()
  const { data: attempt, error: attemptError } = await admin
    .from('placement_attempts')
    .select('*')
    .eq('id', attemptId)
    .maybeSingle()

  if (attemptError || !attempt) {
    return { error: 'Tentative introuvable.' as const }
  }

  const typedAttempt = attempt as PlacementAttempt
  if (typedAttempt.status === 'completed' && typedAttempt.badge && typedAttempt.estimated_level && typedAttempt.recommended_class) {
    return {
      success: true as const,
      result: {
        score: typedAttempt.raw_score,
        xp: typedAttempt.xp_score,
        badge: typedAttempt.badge,
        estimatedLevel: typedAttempt.estimated_level,
        recommendedClass: typedAttempt.recommended_class,
        bestStreak: typedAttempt.best_streak,
        completedAt: typedAttempt.completed_at,
      },
    }
  }

  const [questions, answersResult] = await Promise.all([
    getActiveEnglishQuestions(),
    admin
      .from('placement_answers')
      .select('question_id, selected_option')
      .eq('attempt_id', attemptId),
  ])

  if (answersResult.error) {
    return { error: answersResult.error.message }
  }

  const evaluation = evaluatePlacementAttempt({
    questions,
    answers: (answersResult.data || []) as Array<{ question_id: string; selected_option: PlacementOption }>,
  })

  const completedAt = new Date().toISOString()

  const { error: updateAttemptError } = await admin
    .from('placement_attempts')
    .update({
      status: 'completed',
      answered_questions: evaluation.answeredQuestions,
      correct_answers: evaluation.correctAnswers,
      raw_score: evaluation.rawScore,
      xp_score: evaluation.xpScore,
      current_streak: evaluation.currentStreak,
      best_streak: evaluation.bestStreak,
      badge: evaluation.badge,
      estimated_level: evaluation.estimatedLevel,
      recommended_class: evaluation.recommendedClass,
      completed_at: completedAt,
    })
    .eq('id', attemptId)

  if (updateAttemptError) {
    return { error: updateAttemptError.message }
  }

  if (typedAttempt.lead_id) {
    await admin
      .from('crm_leads')
      .update({
        audience: typedAttempt.audience,
        status: 'test_completed',
        student_level: evaluation.estimatedLevel,
        placement_test_completed_at: completedAt,
        placement_test_score: evaluation.rawScore,
        placement_test_total_questions: evaluation.totalQuestions,
        placement_test_xp: evaluation.xpScore,
        placement_test_badge: evaluation.badge,
        placement_test_level: evaluation.estimatedLevel,
        placement_test_recommended_class: evaluation.recommendedClass,
        program_interest: evaluation.recommendedClass,
        next_follow_up_at: completedAt,
        last_contact_at: completedAt,
      })
      .eq('id', typedAttempt.lead_id)

    await admin
      .from('crm_notes')
      .insert({
        lead_id: typedAttempt.lead_id,
        note: `English Quest terminé : ${evaluation.badge} (${evaluation.estimatedLevel}), score ${evaluation.rawScore}%, ${evaluation.xpScore} XP.`,
      })

    const messageText = buildPlacementTestCompletedMessage({
      fullName: typedAttempt.full_name,
      phone: typedAttempt.contact_phone,
      audience: typedAttempt.audience,
      score: evaluation.rawScore,
      xp: evaluation.xpScore,
      badge: evaluation.badge,
      level: evaluation.estimatedLevel,
      recommendedClass: evaluation.recommendedClass,
    })

    const result = await sendTelegramMessage(messageText)
    await logAlertToSupabase({
      alertType: 'placement_test_completed',
      referenceId: typedAttempt.lead_id,
      referenceDate: completedAt.slice(0, 10),
      messageText,
      result,
    })
  }

  return {
    success: true as const,
    result: {
      score: evaluation.rawScore,
      xp: evaluation.xpScore,
      badge: evaluation.badge,
      estimatedLevel: evaluation.estimatedLevel,
      recommendedClass: evaluation.recommendedClass,
      bestStreak: evaluation.bestStreak,
      summary: evaluation.summary,
      completedAt,
    },
  }
}
