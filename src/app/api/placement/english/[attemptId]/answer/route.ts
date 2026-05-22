import { NextResponse } from 'next/server'
import { recordEnglishQuestAnswer } from '@/lib/placement/server'

export const dynamic = 'force-dynamic'

export async function POST(
  request: Request,
  context: { params: Promise<{ attemptId: string }> },
) {
  const { attemptId } = await context.params
  const payload = (await request.json().catch(() => null)) as
    | {
        questionId?: string
        selectedOption?: 'A' | 'B' | 'C' | 'D'
      }
    | null

  if (!payload?.questionId || !payload?.selectedOption) {
    return NextResponse.json(
      { ok: false, error: 'Question et réponse sont obligatoires.' },
      { status: 400 },
    )
  }

  const result = await recordEnglishQuestAnswer({
    attemptId,
    questionId: payload.questionId,
    selectedOption: payload.selectedOption,
  })

  if ('error' in result) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 400 })
  }

  return NextResponse.json({
    ok: true,
    correct: result.correct,
    xpScore: result.xpScore,
    currentStreak: result.currentStreak,
    bestStreak: result.bestStreak,
    answeredQuestions: result.answeredQuestions,
    totalQuestions: result.totalQuestions,
  })
}
