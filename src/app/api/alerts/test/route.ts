import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { sendTelegramMessage } from '@/lib/telegram/sendAlert'
import { getAlertsSupabaseClient } from '@/lib/telegram/checkAlerts'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ ok: false, error: 'Non authentifié' }, { status: 403 })
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') {
    return NextResponse.json({ ok: false, error: 'Accès refusé' }, { status: 403 })
  }

  const url = new URL(request.url)
  const mode = url.searchParams.get('mode') || 'send'

  if (mode === 'status') {
    return NextResponse.json({
      ok: true,
      configured: Boolean(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_ADMIN_CHAT_ID),
      botConfigured: Boolean(process.env.TELEGRAM_BOT_TOKEN),
      chatConfigured: Boolean(process.env.TELEGRAM_ADMIN_CHAT_ID),
    })
  }

  if (mode === 'history') {
    const service = getAlertsSupabaseClient()
    const { data, error } = await service
      .from('telegram_alerts_log')
      .select('id, alert_type, reference_date, sent_at, sent_ok, message_text')
      .order('sent_at', { ascending: false })
      .limit(20)

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
    }

    return NextResponse.json({
      ok: true,
      alerts: (data || []).map((entry) => ({
        id: entry.id,
        type: entry.alert_type,
        date: entry.reference_date,
        sent_at: entry.sent_at,
        sent_ok: entry.sent_ok,
        message: entry.message_text,
      })),
    })
  }

  const testedAt = new Date().toLocaleString('fr-FR', {
    timeZone: 'Africa/Casablanca',
    dateStyle: 'full',
    timeStyle: 'short',
  })

  const message = [
    '✅ <b>Test Cambridge Campus</b>',
    '',
    'La connexion Telegram fonctionne correctement.',
    '',
    `🕐 Testé le ${testedAt}`,
    '🌍 Fuseau : Africa/Casablanca',
  ].join('\n')

  const result = await sendTelegramMessage(message)

  if (!result.ok) {
    return NextResponse.json(
      { ok: false, error: result.error || 'Impossible d’envoyer le message de test' },
      { status: 500 },
    )
  }

  return NextResponse.json({
    ok: true,
    message: 'Message envoyé avec succès',
  })
}
