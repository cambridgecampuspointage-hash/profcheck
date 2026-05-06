import { NextResponse } from 'next/server'
import { buildDailySummary, getAlertsSupabaseClient } from '@/lib/telegram/checkAlerts'

export const dynamic = 'force-dynamic'

function isAuthorized(request: Request) {
  const header = request.headers.get('authorization')
  const expected = process.env.CRON_SECRET
  return Boolean(expected && header === `Bearer ${expected}`)
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ ok: false, error: 'Non autorisé' }, { status: 401 })
  }

  try {
    const supabase = getAlertsSupabaseClient()
    const today = new Date().toLocaleDateString('fr-CA', {
      timeZone: 'Africa/Casablanca',
    })

    await buildDailySummary(supabase, today)

    return NextResponse.json({
      ok: true,
      sent_at: new Date().toISOString(),
    })
  } catch (error) {
    console.error('[telegram] /api/alerts/daily-summary:', error)
    return NextResponse.json(
      { ok: false, error: 'Erreur interne lors de l’envoi du résumé quotidien' },
      { status: 500 },
    )
  }
}
