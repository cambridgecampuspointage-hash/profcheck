import type { PlacementQuestion } from '@/lib/types'

export type QuestBadge = 'Explorer' | 'Starter' | 'Traveler' | 'Communicator' | 'Achiever' | 'Master'
export type QuestLevel = 'Pre-A1' | 'A1' | 'A2' | 'B1' | 'B2' | 'C1'

export type PlacementEvaluation = {
  totalQuestions: number
  answeredQuestions: number
  correctAnswers: number
  rawScore: number
  xpScore: number
  currentStreak: number
  bestStreak: number
  badge: QuestBadge
  estimatedLevel: QuestLevel
  recommendedClass: string
  summary: string
}

export const QUEST_BADGE_META: Record<QuestBadge, { level: QuestLevel; summary: string; recommendedClass: string }> = {
  Explorer: {
    level: 'Pre-A1',
    summary: 'You are starting to recognize everyday English and can build your first simple phrases.',
    recommendedClass: 'English Foundations',
  },
  Starter: {
    level: 'A1',
    summary: 'You can handle simple introductions, personal information, and short familiar exchanges.',
    recommendedClass: 'A1 English',
  },
  Traveler: {
    level: 'A2',
    summary: 'You can manage common daily situations and understand practical English with support.',
    recommendedClass: 'A2 English',
  },
  Communicator: {
    level: 'B1',
    summary: 'You can understand everyday English and join conversations with growing confidence.',
    recommendedClass: 'B1 English',
  },
  Achiever: {
    level: 'B2',
    summary: 'You communicate clearly in most situations and can express opinions with strong control.',
    recommendedClass: 'B2 English',
  },
  Master: {
    level: 'C1',
    summary: 'You use English flexibly and can handle advanced ideas with precision and nuance.',
    recommendedClass: 'Advanced English C1',
  },
}

export function getQuestBadgeFromPercentage(percentage: number): QuestBadge {
  if (percentage >= 90) return 'Master'
  if (percentage >= 75) return 'Achiever'
  if (percentage >= 60) return 'Communicator'
  if (percentage >= 45) return 'Traveler'
  if (percentage >= 30) return 'Starter'
  return 'Explorer'
}

export function evaluatePlacementAttempt(params: {
  questions: Array<Pick<PlacementQuestion, 'id' | 'correct_option' | 'xp_points' | 'mission_order' | 'question_order'>>
  answers: Array<{ question_id: string; selected_option: 'A' | 'B' | 'C' | 'D' }>
}): PlacementEvaluation {
  const orderedQuestions = [...params.questions].sort((a, b) => {
    if (a.mission_order !== b.mission_order) return a.mission_order - b.mission_order
    return a.question_order - b.question_order
  })

  const answerMap = new Map(params.answers.map((answer) => [answer.question_id, answer.selected_option]))
  let correctAnswers = 0
  let xpScore = 0
  let currentStreak = 0
  let bestStreak = 0
  let answeredQuestions = 0

  orderedQuestions.forEach((question) => {
    const selected = answerMap.get(question.id)
    if (!selected) return

    answeredQuestions += 1
    const correct = selected === question.correct_option
    if (correct) {
      correctAnswers += 1
      xpScore += question.xp_points
      currentStreak += 1
      bestStreak = Math.max(bestStreak, currentStreak)
      return
    }

    currentStreak = 0
  })

  const totalQuestions = orderedQuestions.length
  const rawScore = totalQuestions ? Math.round((correctAnswers / totalQuestions) * 100) : 0
  const badge = getQuestBadgeFromPercentage(rawScore)
  const meta = QUEST_BADGE_META[badge]

  return {
    totalQuestions,
    answeredQuestions,
    correctAnswers,
    rawScore,
    xpScore,
    currentStreak,
    bestStreak,
    badge,
    estimatedLevel: meta.level,
    recommendedClass: meta.recommendedClass,
    summary: meta.summary,
  }
}
