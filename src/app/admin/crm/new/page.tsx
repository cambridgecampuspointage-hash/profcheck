'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createCrmLead, getCenters, getCrmAssignableUsers } from '@/lib/actions'
import type { Center, Profile } from '@/lib/types'
import { LeadForm } from '../components/LeadForm'

export default function NewCrmLeadPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [centers, setCenters] = useState<Center[]>([])
  const [assignableUsers, setAssignableUsers] = useState<Profile[]>([])

  useEffect(() => {
    let active = true
    async function loadData() {
      const [centerData, userData] = await Promise.all([
        getCenters(),
        getCrmAssignableUsers(),
      ])
      if (!active) return
      setCenters(centerData as Center[])
      setAssignableUsers(userData)
      setLoading(false)
    }
    void loadData()
    return () => {
      active = false
    }
  }, [])

  return (
    <div style={{ display: 'grid', gap: '1rem' }}>
      <div>
        <h1 style={{ fontSize: '1.6rem', fontWeight: 800, marginBottom: 4 }}>Nouveau prospect</h1>
        <p style={{ color: '#64748b' }}>Créer une fiche parent / étudiant et planifier la première relance.</p>
      </div>

      <div className="card">
        {loading ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: '#64748b' }}>Chargement...</div>
        ) : (
          <LeadForm
            centers={centers}
            assignableUsers={assignableUsers}
            submitLabel="Créer le prospect"
            onSubmit={async (values) => {
              const result = await createCrmLead({
                center_id: values.center_id || null,
                assigned_to: values.assigned_to || null,
                parent_name: values.parent_name,
                parent_phone: values.parent_phone || null,
                parent_whatsapp: values.parent_whatsapp || null,
                parent_email: values.parent_email || null,
                student_name: values.student_name,
                student_age: values.student_age ? Number(values.student_age) : null,
                student_level: values.student_level || null,
                program_interest: values.program_interest || null,
                availability: values.availability || null,
                goal: values.goal || null,
                source: values.source || null,
                status: values.status,
                trial_date: values.trial_date ? new Date(values.trial_date).toISOString() : null,
                next_follow_up_at: values.next_follow_up_at ? new Date(values.next_follow_up_at).toISOString() : null,
                lost_reason: values.lost_reason || null,
              })

              if (result.error) {
                window.alert(result.error)
                return
              }

              router.push(`/admin/crm/${result.leadId}`)
            }}
          />
        )}
      </div>
    </div>
  )
}
