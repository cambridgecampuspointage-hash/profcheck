import { NextResponse } from 'next/server'
import { generateAiText } from '@/lib/ai/client'
import { buildAlertsSummaryContext } from '@/lib/ai/features'
import { buildAlertsSummaryPrompt } from '@/lib/ai/prompts'
import { requireRole } from '../_helpers'

export async function GET(request: Request) {
  const auth = await requireRole(['admin'])
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  try {
    const force = new URL(request.url).searchParams.get('force') === '1'
    const context = await buildAlertsSummaryContext()
    if (!context.shouldGenerate) {
      return NextResponse.json({
        ok: true,
        text: context.emptyMessage,
        cached: false,
        skipped: true,
      })
    }

    const result = await generateAiText({
      feature: 'alerts_summary',
      system: 'Tu es un assistant admin qui résume la santé du système d’alertes Telegram.',
      prompt: buildAlertsSummaryPrompt(context.context),
      promptSummary: 'telegram alerts summary',
      referenceType: 'telegram_alerts',
      referenceId: 'last_7_days',
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
