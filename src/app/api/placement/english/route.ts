import { NextResponse } from 'next/server'
import { getPublicEnglishQuestQuestions, startEnglishQuest } from '@/lib/placement/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const questions = await getPublicEnglishQuestQuestions()
    return NextResponse.json({
      ok: true,
      questions,
    })
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Impossible de charger le test.' },
      { status: 500 },
    )
  }
}

export async function POST(request: Request) {
  const payload = (await request.json().catch(() => null)) as
    | {
        fullName?: string
        phone?: string
        age?: number | null
        audience?: 'junior' | 'adult'
      }
    | null

  if (!payload?.fullName || !payload?.phone || !payload?.audience) {
    return NextResponse.json(
      { ok: false, error: 'Nom, téléphone et parcours sont obligatoires.' },
      { status: 400 },
    )
  }

  const result = await startEnglishQuest({
    fullName: payload.fullName,
    phone: payload.phone,
    age: typeof payload.age === 'number' ? payload.age : null,
    audience: payload.audience,
  })

  if ('error' in result) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 400 })
  }

  return NextResponse.json({
    ok: true,
    attemptId: result.attemptId,
    leadId: result.leadId,
    totalQuestions: result.totalQuestions,
    existingAttempt: result.existingAttempt,
    result: 'result' in result ? result.result : null,
  })
}
