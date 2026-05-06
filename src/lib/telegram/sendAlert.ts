import { createClient } from '@supabase/supabase-js'

export interface TelegramSendResult {
  ok: boolean
  messageId?: number
  error?: string
}

type LogAlertParams = {
  alertType: string
  referenceId?: string
  referenceDate: string
  messageText: string
  result: TelegramSendResult
}

function createServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

export async function sendTelegramMessage(
  text: string,
  chatId?: string,
): Promise<TelegramSendResult> {
  const token = process.env.TELEGRAM_BOT_TOKEN
  const recipientChatId = chatId || process.env.TELEGRAM_ADMIN_CHAT_ID

  if (!token || !recipientChatId) {
    console.warn('[telegram] Configuration manquante: TELEGRAM_BOT_TOKEN ou TELEGRAM_ADMIN_CHAT_ID')
    return {
      ok: false,
      error: 'Configuration Telegram manquante',
    }
  }

  try {
    const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        chat_id: recipientChatId,
        text,
        parse_mode: 'HTML',
        disable_web_page_preview: true,
      }),
    })

    if (!response.ok) {
      return {
        ok: false,
        error: `HTTP ${response.status}`,
      }
    }

    const payload = (await response.json()) as {
      ok: boolean
      description?: string
      result?: { message_id?: number }
    }

    if (!payload.ok) {
      return {
        ok: false,
        error: payload.description || 'Réponse Telegram invalide',
      }
    }

    return {
      ok: true,
      messageId: payload.result?.message_id,
    }
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Erreur réseau inconnue',
    }
  }
}

export async function logAlertToSupabase({
  alertType,
  referenceId,
  referenceDate,
  messageText,
  result,
}: LogAlertParams): Promise<void> {
  try {
    const supabase = createServiceClient()
    await supabase.from('telegram_alerts_log').insert({
      alert_type: alertType,
      reference_id: referenceId || null,
      reference_date: referenceDate,
      recipient_chat_id: process.env.TELEGRAM_ADMIN_CHAT_ID || 'missing-chat-id',
      message_text: messageText,
      telegram_message_id: result.messageId || null,
      sent_ok: result.ok,
      error_message: result.error || null,
    })
  } catch (error) {
    console.error('[telegram] Impossible de journaliser l’alerte:', error)
  }
}

export async function alreadySentToday(
  alertType: string,
  referenceId: string,
  date: string,
): Promise<boolean> {
  try {
    const supabase = createServiceClient()
    const { data, error } = await supabase
      .from('telegram_alerts_log')
      .select('id')
      .eq('alert_type', alertType)
      .eq('reference_id', referenceId)
      .eq('reference_date', date)
      .maybeSingle()

    if (error) {
      console.error('[telegram] Vérification anti-spam échouée:', error.message)
      return true
    }

    return Boolean(data?.id)
  } catch (error) {
    console.error('[telegram] Vérification anti-spam impossible:', error)
    return true
  }
}
