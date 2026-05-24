import { NextResponse } from 'next/server'
import { generateAiText } from '@/lib/ai/client'
import { buildAdminChatContext } from '@/lib/ai/features'
import { buildAdminChatSystemPrompt } from '@/lib/ai/prompts'
import { requireRole } from '../_helpers'

export async function POST(request: Request) {
  const auth = await requireRole(['admin'])
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const body = await request.json().catch(() => null)
  const message = typeof body?.message === 'string' ? body.message.trim() : ''
  const mode = typeof body?.mode === 'string' ? body.mode.trim() : 'general'

  if (!message) {
    return NextResponse.json({ error: 'Message vide.' }, { status: 400 })
  }

  const context = await buildAdminChatContext(mode)
  const system = buildAdminChatSystemPrompt(mode)
  const prompt = [
    'Contexte opérationnel interne :',
    context,
    '',
    'Question admin :',
    message,
  ].join('\n')

  try {
    const result = await generateAiText({
      feature: 'admin_chat',
      system,
      prompt,
      promptSummary: `${mode}: ${message.slice(0, 120)}`,
      referenceType: 'admin_chat',
      referenceId: mode,
      createdBy: auth.user.id,
    })

    return NextResponse.json({
      ok: true,
      provider: result.provider,
      model: result.model,
      text: result.text,
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erreur IA.' },
      { status: 500 }
    )
  }
}
