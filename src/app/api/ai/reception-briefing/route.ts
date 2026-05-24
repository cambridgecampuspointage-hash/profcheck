import { NextResponse } from 'next/server'
import { generateAiText } from '@/lib/ai/client'
import { buildReceptionBriefingContext } from '@/lib/ai/features'
import { buildReceptionBriefingPrompt } from '@/lib/ai/prompts'
import { requireRole } from '../_helpers'

export async function GET(request: Request) {
  const auth = await requireRole(['admin'])
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  try {
    const force = new URL(request.url).searchParams.get('force') === '1'
    const context = await buildReceptionBriefingContext()
    if (!context.shouldGenerate) {
      return NextResponse.json({
        ok: true,
        text: context.emptyMessage,
        cached: false,
        skipped: true,
      })
    }

    const result = await generateAiText({
      feature: 'reception_briefing',
      system: 'Tu es un assistant réception pour Cambridge Campus. Tu produis des briefings courts et utiles en français.',
      prompt: buildReceptionBriefingPrompt(context.context),
      promptSummary: 'daily reception briefing',
      referenceType: 'reception_dashboard',
      referenceId: 'today',
      createdBy: auth.user.id,
      cacheMaxMinutes: 5,
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
