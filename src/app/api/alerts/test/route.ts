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
    const type = url.searchParams.get('type')
    const status = url.searchParams.get('status')
    const dateFrom = url.searchParams.get('dateFrom')
    const dateTo = url.searchParams.get('dateTo')
    const service = getAlertsSupabaseClient()
    let query = service
      .from('telegram_alerts_log')
      .select('id, alert_type, reference_date, sent_at, sent_ok, message_text, error_message')
      .order('sent_at', { ascending: false })

    if (type) query = query.eq('alert_type', type)
    if (status === 'sent') query = query.eq('sent_ok', true)
    if (status === 'error') query = query.eq('sent_ok', false)
    if (dateFrom) query = query.gte('reference_date', dateFrom)
    if (dateTo) query = query.lte('reference_date', dateTo)

    const { data, error } = await query.limit(100)

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
        error_message: entry.error_message,
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
