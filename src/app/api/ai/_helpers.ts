import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

export async function requireRole(roles: Array<'admin' | 'teacher' | 'reception'>) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'Non authentifié', status: 401 as const }
  }

  const admin = createAdminClient()
  const { data: profile } = await admin
    .from('profiles')
    .select('id, role')
    .eq('id', user.id)
    .maybeSingle()

  if (!profile || !roles.includes(profile.role)) {
    return { error: 'Accès refusé', status: 403 as const }
  }

  return {
    user,
    profile,
  }
}
