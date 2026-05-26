#!/usr/bin/env node
const { McpServer } = require('@modelcontextprotocol/sdk/server/mcp.js')
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js')
const { createClient } = require('@supabase/supabase-js')
const { z } = require('zod')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const mcpToken = process.env.MCP_TOKEN

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const admin = createClient(supabaseUrl, supabaseKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

// ─── TOKEN VALIDATION ─────────────────────────────────────────────────────────

let currentProfileId = null

async function validateToken() {
  if (!mcpToken) {
    console.error('Missing MCP_TOKEN — set it in your env or .env.local')
    process.exit(1)
  }
  if (!mcpToken.startsWith('pc_mcp_')) {
    console.error('Invalid MCP_TOKEN format — must start with pc_mcp_')
    process.exit(1)
  }
  const { data, error } = await admin
    .from('mcp_tokens')
    .select('profile_id, is_active, expires_at')
    .eq('token', mcpToken)
    .maybeSingle()
  if (error || !data) {
    console.error('MCP_TOKEN not found — generate one from the ProfCheck dashboard')
    process.exit(1)
  }
  if (!data.is_active) {
    console.error('MCP_TOKEN is revoked — generate a new one from the ProfCheck dashboard')
    process.exit(1)
  }
  if (data.expires_at && new Date(data.expires_at) < new Date()) {
    console.error('MCP_TOKEN has expired — generate a new one')
    process.exit(1)
  }
  currentProfileId = data.profile_id
  await admin.from('mcp_tokens').update({ last_used_at: new Date().toISOString() }).eq('token', mcpToken)
  console.error(`MCP token validated for profile ${currentProfileId}`)
}

await validateToken()

const server = new McpServer({
  name: 'profcheck-mcp',
  version: '0.1.0',
})

// ─── HELPERS ─────────────────────────────────────────────────────────────────

function errorText(msg) {
  return { content: [{ type: 'text', text: msg }], isError: true }
}

function okText(data) {
  return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] }
}

async function fetchAll(table, options = {}) {
  const { select = '*', orderBy, orderDir = 'asc', limit: maxRows } = options
  let q = admin.from(table).select(select)
  if (orderBy) q = q.order(orderBy, { ascending: orderDir === 'asc' })
  if (maxRows) q = q.limit(maxRows)
  const { data, error } = await q
  if (error) throw error
  return data || []
}

async function fetchOne(table, column, value, select = '*') {
  const { data, error } = await admin.from(table).select(select).eq(column, value).maybeSingle()
  if (error) throw error
  return data
}

async function insertOne(table, payload) {
  const { data, error } = await admin.from(table).insert(payload).select().single()
  if (error) throw error
  return data
}

async function updateOne(table, column, value, payload) {
  const { data, error } = await admin.from(table).update(payload).eq(column, value).select()
  if (error) throw error
  return data
}

async function deleteOne(table, column, value) {
  const { error } = await admin.from(table).delete().eq(column, value)
  if (error) throw error
  return true
}

// ─── CENTERS ──────────────────────────────────────────────────────────────────

server.tool('list_centers', 'List all centers', {}, async () => {
  try {
    const data = await fetchAll('centers', { orderBy: 'name' })
    return okText(data)
  } catch (e) { return errorText(e.message) }
})

server.tool('get_center', 'Get a center by ID',
  { id: z.string() },
  async ({ id }) => {
    try {
      const data = await fetchOne('centers', 'id', id)
      return data ? okText(data) : errorText('Center not found')
    } catch (e) { return errorText(e.message) }
  }
)

server.tool('create_center', 'Create a new center',
  {
    name: z.string().min(1),
    address: z.string().optional(),
    latitude: z.number(),
    longitude: z.number(),
    allowed_radius_meters: z.number().optional().default(100),
    gps_verification_enabled: z.boolean().optional().default(true),
  },
  async (args) => {
    try {
      const data = await insertOne('centers', args)
      return okText(data)
    } catch (e) { return errorText(e.message) }
  }
)

server.tool('update_center', 'Update a center',
  {
    id: z.string(),
    name: z.string().optional(),
    address: z.string().optional(),
    latitude: z.number().optional(),
    longitude: z.number().optional(),
    allowed_radius_meters: z.number().optional(),
    gps_verification_enabled: z.boolean().optional(),
  },
  async ({ id, ...rest }) => {
    try {
      const data = await updateOne('centers', 'id', id, rest)
      return okText(data)
    } catch (e) { return errorText(e.message) }
  }
)

server.tool('delete_center', 'Delete a center',
  { id: z.string() },
  async ({ id }) => {
    try {
      await deleteOne('centers', 'id', id)
      return okText({ deleted: true })
    } catch (e) { return errorText(e.message) }
  }
)

// ─── ROOMS ────────────────────────────────────────────────────────────────────

server.tool('list_rooms', 'List all rooms with their center', {}, async () => {
  try {
    const data = await fetchAll('rooms', { select: '*, center:centers(*)', orderBy: 'name' })
    return okText(data)
  } catch (e) { return errorText(e.message) }
})

server.tool('create_room', 'Create a new room',
  {
    center_id: z.string(),
    name: z.string().min(1),
    description: z.string().optional(),
  },
  async ({ center_id, name, description }) => {
    try {
      const data = await insertOne('rooms', { center_id, name, description: description || null })
      return okText(data)
    } catch (e) { return errorText(e.message) }
  }
)

server.tool('update_room', 'Update a room',
  {
    id: z.string(),
    name: z.string().optional(),
    description: z.string().optional(),
    status: z.string().optional(),
  },
  async ({ id, ...rest }) => {
    try {
      const data = await updateOne('rooms', 'id', id, rest)
      return okText(data)
    } catch (e) { return errorText(e.message) }
  }
)

server.tool('delete_room', 'Delete a room',
  { id: z.string() },
  async ({ id }) => {
    try {
      await deleteOne('rooms', 'id', id)
      return okText({ deleted: true })
    } catch (e) { return errorText(e.message) }
  }
)

// ─── TEACHERS ─────────────────────────────────────────────────────────────────

server.tool('list_teachers', 'List all teachers', {}, async () => {
  try {
    const data = await fetchAll('teachers', { orderBy: 'full_name' })
    return okText(data)
  } catch (e) { return errorText(e.message) }
})

server.tool('get_teacher', 'Get a teacher by ID',
  { id: z.string() },
  async ({ id }) => {
    try {
      const data = await fetchOne('teachers', 'id', id)
      return data ? okText(data) : errorText('Teacher not found')
    } catch (e) { return errorText(e.message) }
  }
)

server.tool('create_teacher', 'Create a new teacher (also creates auth user)',
  {
    full_name: z.string().min(1),
    email: z.string().email(),
    phone: z.string().optional(),
    languages: z.array(z.string()).optional(),
    hourly_rate: z.number().optional(),
    hourly_rate_short: z.number().optional(),
    hourly_rate_long: z.number().optional(),
  },
  async ({ full_name, email, phone, languages, hourly_rate, hourly_rate_short, hourly_rate_long }) => {
    try {
      const crypto = require('crypto')
      const tempPassword = crypto.randomBytes(16).toString('hex')
      const { data: authUser, error: authError } = await admin.auth.admin.createUser({
        email,
        password: tempPassword,
        email_confirm: true,
        user_metadata: { full_name, role: 'teacher' },
      })
      if (authError) return errorText(authError.message)

      await admin.from('teachers').update({
        full_name,
        phone: phone || null,
        languages: languages || [],
        hourly_rate: hourly_rate_short || hourly_rate || 0,
        hourly_rate_short: hourly_rate_short || hourly_rate || 0,
        hourly_rate_long: hourly_rate_long || hourly_rate || 0,
      }).eq('user_id', authUser.user.id)

      return okText({ success: true, teacher_id: authUser.user.id, temp_password: tempPassword })
    } catch (e) { return errorText(e.message) }
  }
)

server.tool('update_teacher', 'Update a teacher',
  {
    id: z.string(),
    full_name: z.string().optional(),
    phone: z.string().optional(),
    languages: z.array(z.string()).optional(),
    hourly_rate: z.number().optional(),
    hourly_rate_short: z.number().optional(),
    hourly_rate_long: z.number().optional(),
    status: z.string().optional(),
  },
  async ({ id, ...rest }) => {
    try {
      const data = await updateOne('teachers', 'id', id, rest)
      return okText(data)
    } catch (e) { return errorText(e.message) }
  }
)

server.tool('delete_teacher', 'Delete a teacher and their auth user',
  { id: z.string() },
  async ({ id }) => {
    try {
      const t = await fetchOne('teachers', 'id', id)
      if (!t) return errorText('Teacher not found')
      if (t.user_id) await admin.auth.admin.deleteUser(t.user_id)
      await deleteOne('teachers', 'id', id)
      return okText({ deleted: true })
    } catch (e) { return errorText(e.message) }
  }
)

server.tool('reset_teacher_password', 'Reset a teacher password',
  { teacher_id: z.string() },
  async ({ teacher_id }) => {
    try {
      const crypto = require('crypto')
      const t = await fetchOne('teachers', 'id', teacher_id)
      if (!t || !t.user_id) return errorText('Teacher not found or no auth user')
      const tempPassword = crypto.randomBytes(16).toString('hex')
      await admin.auth.admin.updateUserById(t.user_id, { password: tempPassword })
      return okText({ success: true, temp_password: tempPassword, full_name: t.full_name })
    } catch (e) { return errorText(e.message) }
  }
)

// ─── RECEPTION USERS (profiles) ──────────────────────────────────────────────

server.tool('list_reception_users', 'List all reception users', {}, async () => {
  try {
    const data = await admin.from('profiles').select('*').eq('role', 'reception').order('full_name')
    return okText(data.data || [])
  } catch (e) { return errorText(e.message) }
})

server.tool('create_reception_user', 'Create a new reception user',
  {
    full_name: z.string().min(1),
    email: z.string().email(),
    phone: z.string().optional(),
  },
  async ({ full_name, email, phone }) => {
    try {
      const crypto = require('crypto')
      const tempPassword = crypto.randomBytes(16).toString('hex')
      const { data: authUser, error: authError } = await admin.auth.admin.createUser({
        email, password: tempPassword, email_confirm: true,
        user_metadata: { full_name, role: 'reception' },
      })
      if (authError) return errorText(authError.message)
      await admin.from('profiles').update({
        full_name, phone: phone || null, role: 'reception', status: 'active',
      }).eq('id', authUser.user.id)
      return okText({ success: true, user_id: authUser.user.id, temp_password: tempPassword })
    } catch (e) { return errorText(e.message) }
  }
)

// ─── PROFILES ─────────────────────────────────────────────────────────────────

server.tool('list_profiles', 'List all user profiles', {}, async () => {
  try {
    const data = await fetchAll('profiles', { orderBy: 'full_name' })
    return okText(data)
  } catch (e) { return errorText(e.message) }
})

// ─── STUDENTS ─────────────────────────────────────────────────────────────────

server.tool('list_students', 'List all students', {}, async () => {
  try {
    const data = await fetchAll('students', { select: '*, center:centers(*)', orderBy: 'full_name' })
    return okText(data)
  } catch (e) { return errorText(e.message) }
})

server.tool('get_student', 'Get a student by ID',
  { id: z.string() },
  async ({ id }) => {
    try {
      const { data, error } = await admin.from('students').select('*, center:centers(*)').eq('id', id).single()
      if (error) return errorText('Student not found')
      return okText(data)
    } catch (e) { return errorText(e.message) }
  }
)

server.tool('create_student', 'Create a new student',
  {
    center_id: z.string().optional(),
    full_name: z.string().min(1),
    phone: z.string().optional(),
    parent_name: z.string().optional(),
    parent_phone: z.string().optional(),
    email: z.string().optional(),
    payment_due_date: z.string().optional(),
    access_status: z.enum(['allowed', 'blocked']).optional().default('allowed'),
    status: z.enum(['active', 'inactive']).optional().default('active'),
    class_ids: z.array(z.string()).optional(),
  },
  async (args) => {
    try {
      const { class_ids, ...studentData } = args
      const { data: student, error } = await admin.from('students').insert(studentData).select('id').single()
      if (error) return errorText(error.message)
      if (class_ids && class_ids.length > 0) {
        await admin.from('student_class_members').insert(
          class_ids.map(cid => ({ class_id: cid, student_id: student.id }))
        )
      }
      return okText({ success: true, student_id: student.id })
    } catch (e) { return errorText(e.message) }
  }
)

server.tool('update_student', 'Update a student',
  {
    id: z.string(),
    center_id: z.string().optional(),
    full_name: z.string().optional(),
    phone: z.string().optional(),
    parent_name: z.string().optional(),
    parent_phone: z.string().optional(),
    email: z.string().optional(),
    payment_due_date: z.string().optional(),
    access_status: z.enum(['allowed', 'blocked']).optional(),
    status: z.enum(['active', 'inactive']).optional(),
  },
  async ({ id, ...rest }) => {
    try {
      const data = await updateOne('students', 'id', id, rest)
      return okText(data)
    } catch (e) { return errorText(e.message) }
  }
)

server.tool('delete_student', 'Delete a student',
  { id: z.string() },
  async ({ id }) => {
    try {
      await deleteOne('students', 'id', id)
      return okText({ deleted: true })
    } catch (e) { return errorText(e.message) }
  }
)

// ─── STUDENT CLASSES ─────────────────────────────────────────────────────────

server.tool('list_student_classes', 'List all student classes', {}, async () => {
  try {
    const data = await fetchAll('student_classes', {
      select: '*, center:centers(*), teacher:teachers(id, full_name)',
      orderBy: 'name',
    })
    return okText(data)
  } catch (e) { return errorText(e.message) }
})

server.tool('create_student_class', 'Create a new student class',
  {
    center_id: z.string(),
    name: z.string().min(1),
    teacher_id: z.string().optional(),
    level: z.string().optional(),
    status: z.enum(['active', 'inactive']).optional().default('active'),
  },
  async (args) => {
    try {
      const data = await insertOne('student_classes', {
        center_id: args.center_id,
        name: args.name.trim(),
        teacher_id: args.teacher_id || null,
        level: args.level || null,
        status: args.status || 'active',
      })
      return okText(data)
    } catch (e) { return errorText(e.message) }
  }
)

// ─── ATTENDANCE SESSIONS ─────────────────────────────────────────────────────

server.tool('list_attendance_sessions', 'List attendance sessions',
  {
    limit: z.number().optional().default(50),
    teacher_id: z.string().optional(),
    status: z.enum(['active', 'completed', 'rejected', 'pending_review']).optional(),
    date_from: z.string().optional(),
    date_to: z.string().optional(),
  },
  async ({ limit: maxRows, teacher_id, status, date_from, date_to }) => {
    try {
      let q = admin.from('attendance_sessions').select('*, teacher:teachers(full_name), room:rooms(name), center:centers(name)')
      if (teacher_id) q = q.eq('teacher_id', teacher_id)
      if (status) q = q.eq('status', status)
      if (date_from) q = q.gte('started_at', date_from)
      if (date_to) q = q.lt('started_at', date_to)
      q = q.order('started_at', { ascending: false }).limit(maxRows)
      const { data, error } = await q
      if (error) return errorText(error.message)
      return okText(data || [])
    } catch (e) { return errorText(e.message) }
  }
)

server.tool('get_active_sessions', 'Get all active attendance sessions', {}, async () => {
  try {
    const { data, error } = await admin
      .from('attendance_sessions')
      .select('*, teacher:teachers(full_name), room:rooms(name), center:centers(name)')
      .eq('status', 'active')
    if (error) return errorText(error.message)
    return okText(data || [])
  } catch (e) { return errorText(e.message) }
})

// ─── PLANNED SESSIONS ────────────────────────────────────────────────────────

server.tool('list_planned_sessions', 'List planned sessions',
  {
    limit: z.number().optional().default(50),
    teacher_id: z.string().optional(),
    status: z.string().optional(),
    date_from: z.string().optional(),
    date_to: z.string().optional(),
  },
  async ({ limit: maxRows, teacher_id, status, date_from, date_to }) => {
    try {
      let q = admin.from('planned_sessions').select('*, teacher:teachers(full_name), room:rooms(name), campus:centers(name)')
      if (teacher_id) q = q.eq('teacher_id', teacher_id)
      if (status) q = q.eq('status', status)
      if (date_from) q = q.gte('scheduled_date', date_from)
      if (date_to) q = q.lte('scheduled_date', date_to)
      q = q.order('scheduled_date').order('start_time').limit(maxRows)
      const { data, error } = await q
      if (error) return errorText(error.message)
      return okText(data || [])
    } catch (e) { return errorText(e.message) }
  }
)

// ─── CRM LEADS ───────────────────────────────────────────────────────────────

server.tool('list_crm_leads', 'List CRM leads',
  {
    limit: z.number().optional().default(50),
    status: z.string().optional(),
  },
  async ({ limit: maxRows, status }) => {
    try {
      let q = admin.from('crm_leads').select('*, center:centers(*), assignee:profiles!crm_leads_assigned_to_fkey(id, full_name, role)')
      if (status) q = q.eq('status', status)
      q = q.order('created_at', { ascending: false }).limit(maxRows)
      const { data, error } = await q
      if (error) return errorText(error.message)
      return okText(data || [])
    } catch (e) { return errorText(e.message) }
  }
)

server.tool('create_crm_lead', 'Create a CRM lead',
  {
    center_id: z.string().optional(),
    assigned_to: z.string().optional(),
    parent_name: z.string().min(1),
    parent_phone: z.string().optional(),
    parent_whatsapp: z.string().optional(),
    parent_email: z.string().optional(),
    audience: z.enum(['junior', 'adult']).optional(),
    student_name: z.string().min(1),
    student_age: z.number().optional(),
    student_level: z.string().optional(),
    program_interest: z.string().optional(),
    availability: z.string().optional(),
    goal: z.string().optional(),
    source: z.string().optional(),
    status: z.string().optional().default('new'),
  },
  async (args) => {
    try {
      const data = await insertOne('crm_leads', args)
      return okText(data)
    } catch (e) { return errorText(e.message) }
  }
)

// ─── APP SETTINGS ────────────────────────────────────────────────────────────

server.tool('get_app_settings', 'Get global app settings', {}, async () => {
  try {
    const { data, error } = await admin.from('app_settings').select('*').eq('id', 'global').maybeSingle()
    if (error) return errorText(error.message)
    return okText(data || {})
  } catch (e) { return errorText(e.message) }
})

// ─── RAW QUERY ────────────────────────────────────────────────────────────────

server.tool('run_query', 'Run a raw Supabase query (read-only)',
  {
    table: z.string(),
    select: z.string().optional().default('*'),
    filters: z.array(z.object({
      column: z.string(),
      operator: z.enum(['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'like', 'ilike', 'in', 'is']),
      value: z.any(),
    })).optional(),
    order_by: z.string().optional(),
    order_dir: z.enum(['asc', 'desc']).optional().default('asc'),
    limit: z.number().optional().default(100),
  },
  async ({ table, select: cols, filters, order_by, order_dir, limit: maxRows }) => {
    try {
      let q = admin.from(table).select(cols)
      if (filters) {
        for (const f of filters) {
          if (f.operator === 'in') {
            q = q.in(f.column, f.value)
          } else if (f.operator === 'is') {
            q = q.is(f.column, f.value)
          } else {
            q = q[f.operator](f.column, f.value)
          }
        }
      }
      if (order_by) q = q.order(order_by, { ascending: order_dir === 'asc' })
      q = q.limit(maxRows)
      const { data, error } = await q
      if (error) return errorText(error.message)
      return okText(data || [])
    } catch (e) { return errorText(e.message) }
  }
)

// ─── START ────────────────────────────────────────────────────────────────────

async function main() {
  const transport = new StdioServerTransport()
  await server.connect(transport)
  console.error('ProfCheck MCP server running on stdio')
}

main().catch((e) => {
  console.error('Fatal error:', e)
  process.exit(1)
})
