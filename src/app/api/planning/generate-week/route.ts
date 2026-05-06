import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

function parseIsoDate(dateString: string) {
  const [year, month, day] = dateString.split('-').map(Number)
  if (!year || !month || !day) return null
  return new Date(Date.UTC(year, month - 1, day))
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ success: false, error: 'Non authentifié' }, { status: 401 })
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') {
    return NextResponse.json({ success: false, error: 'Accès refusé' }, { status: 403 })
  }

  const body = await request.json().catch(() => null) as { weekStart?: string } | null
  const weekStart = body?.weekStart || ''
  const parsed = parseIsoDate(weekStart)

  if (!parsed) {
    return NextResponse.json({ success: false, error: 'weekStart invalide' }, { status: 400 })
  }

  if (parsed.getUTCDay() !== 1) {
    return NextResponse.json({ success: false, error: 'weekStart doit être un lundi' }, { status: 400 })
  }

  const { data, error } = await supabase.rpc('generate_week_sessions', {
    week_start: weekStart,
  })

  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true, created: Number(data || 0) })
}
