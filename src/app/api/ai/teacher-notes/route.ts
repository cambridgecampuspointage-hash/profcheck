import { NextResponse } from 'next/server'
import { generateAiText } from '@/lib/ai/client'
import { buildTeacherNotesContext } from '@/lib/ai/features'
import { buildTeacherNotesPrompt } from '@/lib/ai/prompts'
import { requireRole } from '../_helpers'

export async function GET(request: Request) {
  const auth = await requireRole(['teacher', 'admin'])
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  try {
    const force = new URL(request.url).searchParams.get('force') === '1'
    const context = await buildTeacherNotesContext(auth.user.id)
    const result = await generateAiText({
      feature: 'teacher_notes',
      system: 'Tu es un assistant académique qui résume les notes de séance d’un professeur en français clair et utile.',
      prompt: buildTeacherNotesPrompt(context),
      promptSummary: 'teacher notes summary',
      referenceType: 'teacher_history',
      referenceId: auth.user.id,
      createdBy: auth.user.id,
      force,
    })

    return NextResponse.json({
      ok: true,
      provider: result.provider,
      model: result.model,
      text: result.text,
      cached: result.cached,
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erreur IA.' },
      { status: 500 }
    )
  }
}
