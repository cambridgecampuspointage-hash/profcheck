'use client'

import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { LogOut } from 'lucide-react'

export function LogoutButton() {
  const router = useRouter()
  const supabase = createClient()

  const handleLogout = async () => {
    document.cookie = 'demo-session=; path=/; max-age=0'
    document.cookie = 'demo-role=; path=/; max-age=0'
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <button className="btn btn-secondary btn-lg" onClick={handleLogout} style={{ width: '100%' }}>
      <LogOut size={18} />
      Déconnexion
    </button>
  )
}
