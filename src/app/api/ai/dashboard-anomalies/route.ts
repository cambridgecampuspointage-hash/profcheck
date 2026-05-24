import { NextResponse } from 'next/server'
import { generateAiText } from '@/lib/ai/client'
import { buildDashboardAnomaliesContext } from '@/lib/ai/features'
import { buildDashboardAnomaliesPrompt } from '@/lib/ai/prompts'
import { requireRole } from '../_helpers'

export async function GET(request: Request) {
  const auth = await requireRole(['admin'])
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  try {
    const force = new URL(request.url).searchParams.get('force') === '1'
    const context = await buildDashboardAnomaliesContext()
    const result = await generateAiText({
      feature: 'dashboard_anomalies',
      system: 'Tu es un analyste opérationnel senior pour un centre de langues. Tu détectes les anomalies et proposes des actions nettes.',
      prompt: buildDashboardAnomaliesPrompt(context),
      promptSummary: 'dashboard anomalies summary',
      referenceType: 'admin_dashboard',
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
