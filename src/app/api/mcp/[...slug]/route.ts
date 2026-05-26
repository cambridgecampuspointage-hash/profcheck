import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const admin = createClient(supabaseUrl, supabaseKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

function errorRes(msg: string, status = 400) {
  return NextResponse.json({ error: msg }, { status })
}

function okRes(data: unknown) {
  return NextResponse.json(data)
}

async function validateToken(token: string) {
  if (!token || !token.startsWith('pc_mcp_')) return null
  const { data } = await admin
    .from('mcp_tokens')
    .select('profile_id, is_active, expires_at')
    .eq('token', token)
    .maybeSingle()
  if (!data || !data.is_active) return null
  if (data.expires_at && new Date(data.expires_at) < new Date()) return null
  await admin.from('mcp_tokens').update({ last_used_at: new Date().toISOString() }).eq('token', token)
  return data.profile_id
}

const postHandlers: Record<string, (req: NextRequest) => Promise<Response>> = {
  'planned-sessions': async (req) => {
    const body = await req.json().catch(() => ({}))
    const { action, center_id, room_id, teacher_id, scheduled_date, start_time, end_time, status, session_id, name } = body
    if (action === 'create') {
      if (!center_id || !scheduled_date || !start_time) {
        return errorRes('Champs requis : center_id, scheduled_date, start_time')
      }
      const { data, error } = await admin.from('planned_sessions').insert({
        center_id, teacher_id: teacher_id || null, scheduled_date, start_time,
        end_time: end_time || null, status: status || 'scheduled', name: name || null,
      }).select('*, teacher:teachers(full_name), room:rooms(name), campus:centers(name)').single()
      if (error) return errorRes(error.message)
      return okRes(data)
    }
    if (action === 'assign-teacher' || action === 'update') {
      if (!session_id && !body.id) return errorRes('session_id requis')
      const id = session_id || body.id
      const updates: Record<string, unknown> = {}
      if (teacher_id !== undefined) updates.teacher_id = teacher_id
      if (room_id !== undefined) updates.room_id = room_id
      if (scheduled_date !== undefined) updates.scheduled_date = scheduled_date
      if (start_time !== undefined) updates.start_time = start_time
      if (end_time !== undefined) updates.end_time = end_time
      if (status !== undefined) updates.status = status
      if (Object.keys(updates).length === 0) return errorRes('Aucun champ à mettre à jour')
      const { data, error } = await admin.from('planned_sessions').update(updates).eq('id', id).select('*, teacher:teachers(full_name), room:rooms(name), campus:centers(name)').single()
      if (error) return errorRes(error.message)
      return okRes(data)
    }
    return errorRes("action doit être 'create' ou 'update'")
  },
  teachers: async (req) => {
    const body = await req.json().catch(() => ({}))
    const { action, full_name, email, phone, languages, hourly_rate } = body
    if (action !== 'create') return errorRes("action doit être 'create'")
    if (!full_name || !email) return errorRes('Champs requis : full_name, email')
    const crypto = require('crypto')
    const tempPassword = crypto.randomBytes(16).toString('hex')
    const { data: authUser, error: authError } = await admin.auth.admin.createUser({
      email, password: tempPassword, email_confirm: true,
      user_metadata: { full_name, role: 'teacher' },
    })
    if (authError) return errorRes(authError.message)
    await admin.from('teachers').update({
      full_name, phone: phone || null, languages: languages || [],
      hourly_rate: hourly_rate || 0,
    }).eq('user_id', authUser.user.id)
    return okRes({ success: true, teacher_id: authUser.user.id, temp_password: tempPassword })
  },
}

const handlers: Record<string, (req: NextRequest) => Promise<Response>> = {
  ping: async (req) => {
    const authHeader = req.headers.get('authorization') || ''
    return okRes({ status: 'ok', auth_header_present: !!authHeader, auth_length: authHeader.length })
  },
  debug: async (req) => {
    const authHeader = req.headers.get('authorization') || ''
    const token = authHeader.replace('Bearer ', '').trim()
    const tokenFound = token.startsWith('pc_mcp_')
    const tokenCheck = tokenFound ? await admin.from('mcp_tokens').select('id, is_active').eq('token', token).maybeSingle() : null
    return okRes({
      has_auth_header: !!authHeader,
      token_prefix: token.slice(0, 10) + '...' || '(empty)',
      token_starts_with_pc_mcp: tokenFound,
      token_in_db: tokenCheck?.data ? true : false,
      token_is_active: tokenCheck?.data?.is_active ?? false,
      all_headers: Object.fromEntries(req.headers.entries()),
    })
  },
  teachers: async (req) => {
    const { data, error } = await admin.from('teachers').select('*').order('full_name')
    if (error) return errorRes(error.message)
    return okRes(data || [])
  },
  centers: async (req) => {
    const { data, error } = await admin.from('centers').select('*').order('name')
    if (error) return errorRes(error.message)
    return okRes(data || [])
  },
  'sessions/active': async (req) => {
    const { data, error } = await admin
      .from('attendance_sessions')
      .select('*, teacher:teachers(full_name), room:rooms(name), center:centers(name)')
      .eq('status', 'active')
    if (error) return errorRes(error.message)
    return okRes(data || [])
  },
  students: async (req) => {
    const { data, error } = await admin.from('students').select('*, center:centers(*)').order('full_name')
    if (error) return errorRes(error.message)
    return okRes(data || [])
  },
  leads: async (req) => {
    const url = new URL(req.url)
    const status = url.searchParams.get('status')
    const limit = Math.min(Number(url.searchParams.get('limit')) || 50, 200)
    let q = admin.from('crm_leads').select('*, center:centers(*), assignee:profiles!crm_leads_assigned_to_fkey(id, full_name, role)')
    if (status) q = q.eq('status', status)
    const { data, error } = await q.order('created_at', { ascending: false }).limit(limit)
    if (error) return errorRes(error.message)
    return okRes(data || [])
  },
  'planned-sessions': async (req) => {
    const url = new URL(req.url)
    const dateFrom = url.searchParams.get('date_from')
    const dateTo = url.searchParams.get('date_to')
    const limit = Math.min(Number(url.searchParams.get('limit')) || 50, 200)
    let q = admin.from('planned_sessions').select('*, teacher:teachers(full_name), room:rooms(name), campus:centers(name)')
    if (dateFrom) q = q.gte('scheduled_date', dateFrom)
    if (dateTo) q = q.lte('scheduled_date', dateTo)
    const { data, error } = await q.order('scheduled_date').order('start_time').limit(limit)
    if (error) return errorRes(error.message)
    return okRes(data || [])
  },
  rooms: async (req) => {
    const { data, error } = await admin.from('rooms').select('*, center:centers(*)').order('name')
    if (error) return errorRes(error.message)
    return okRes(data || [])
  },
  settings: async (req) => {
    const { data, error } = await admin.from('app_settings').select('*').eq('id', 'global').maybeSingle()
    if (error) return errorRes(error.message)
    return okRes(data || {})
  },
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ slug: string[] }> }) {
  const { slug } = await params
  const path = slug.join('/')

  const handler = handlers[path]
  if (!handler) return errorRes(`Endpoint inconnu: ${path}`, 404)

  if (path === 'debug') return handler(req)

  const authHeader = req.headers.get('authorization') || ''
  let token = ''
  if (/^Bearer\s+/i.test(authHeader)) {
    token = authHeader.replace(/^Bearer\s+/i, '').trim()
  } else if (/^Basic\s+/i.test(authHeader)) {
    const b64 = authHeader.replace(/^Basic\s+/i, '').trim()
    try {
      const decoded = atob(b64)
      token = decoded.includes(':') ? decoded.split(':').pop()!.trim() : decoded.trim()
    } catch { token = '' }
  }
  const profileId = await validateToken(token)
  if (!profileId) {
    const prefix = token.length > 8 ? token.slice(0, 8) + '...' : '(vide)'
    return errorRes(`Token MCP invalide ou révoqué (reçu: ${prefix}) — générez-en un depuis le tableau de bord`, 401)
  }

  return handler(req)
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ slug: string[] }> }) {
  const { slug } = await params
  const path = slug.join('/')

  const handler = postHandlers[path]
  if (!handler) return errorRes(`Endpoint POST inconnu: ${path}`, 404)

  const authHeader = req.headers.get('authorization') || ''
  let token = ''
  if (/^Bearer\s+/i.test(authHeader)) {
    token = authHeader.replace(/^Bearer\s+/i, '').trim()
  } else if (/^Basic\s+/i.test(authHeader)) {
    const b64 = authHeader.replace(/^Basic\s+/i, '').trim()
    try {
      const decoded = atob(b64)
      token = decoded.includes(':') ? decoded.split(':').pop()!.trim() : decoded.trim()
    } catch { token = '' }
  }
  const profileId = await validateToken(token)
  if (!profileId) {
    const prefix = token.length > 8 ? token.slice(0, 8) + '...' : '(vide)'
    return errorRes(`Token MCP invalide ou révoqué (reçu: ${prefix}) — générez-en un depuis le tableau de bord`, 401)
  }

  return handler(req)
}
