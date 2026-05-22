import { NextResponse } from 'next/server'
import { completeEnglishQuest } from '@/lib/placement/server'

export const dynamic = 'force-dynamic'

export async function POST(
  _request: Request,
  context: { params: Promise<{ attemptId: string }> },
) {
  const { attemptId } = await context.params
  const result = await completeEnglishQuest(attemptId)

  if ('error' in result) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 400 })
  }

  return NextResponse.json({
    ok: true,
    result: result.result,
  })
}
