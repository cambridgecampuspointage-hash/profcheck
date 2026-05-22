'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getCrmMessageTemplates, updateCrmLeadStatus } from '@/lib/actions'
import type { CrmLead, CrmMessageTemplate } from '@/lib/types'
import { CrmQuickActions } from '../components/CrmQuickActions'
import { CRM_STATUS_OPTIONS, CRM_STATUS_STYLES, formatDateTime } from '../components/crm-config'

const PIPELINE_COLUMNS: Array<{ status: CrmLead['status']; title: string }> = [
  { status: 'new', title: 'Nouveau' },
  { status: 'contacted', title: 'Contacté' },
  { status: 'interested', title: 'Intéressé' },
  { status: 'trial_scheduled', title: 'Test prévu' },
  { status: 'test_completed', title: 'Test terminé' },
  { status: 'enrolled', title: 'Inscrit' },
  { status: 'lost', title: 'Perdu' },
]

export default function CrmPipelinePage() {
  const supabase = useMemo(() => createClient(), [])
  const [loading, setLoading] = useState(true)
  const [leads, setLeads] = useState<CrmLead[]>([])
  const [templates, setTemplates] = useState<CrmMessageTemplate[]>([])

  const loadData = async () => {
    const [leadRes, templateData] = await Promise.all([
      supabase
        .from('crm_leads')
        .select('*, center:centers(*), assignee:profiles!crm_leads_assigned_to_fkey(id, full_name, role), student:students(*)')
        .not('status', 'eq', 'no_response')
        .order('updated_at', { ascending: false }),
      getCrmMessageTemplates(),
    ])

    setLeads((leadRes.data || []) as CrmLead[])
    setTemplates(templateData)
    setLoading(false)
  }

  useEffect(() => {
    let active = true
    async function bootstrap() {
      const [leadRes, templateData] = await Promise.all([
        supabase
          .from('crm_leads')
          .select('*, center:centers(*), assignee:profiles!crm_leads_assigned_to_fkey(id, full_name, role), student:students(*)')
          .not('status', 'eq', 'no_response')
          .order('updated_at', { ascending: false }),
        getCrmMessageTemplates(),
      ])
      if (!active) return
      setLeads((leadRes.data || []) as CrmLead[])
      setTemplates(templateData)
      setLoading(false)
    }
    void bootstrap()
    return () => {
      active = false
    }
  }, [supabase])

  return (
    <div style={{ display: 'grid', gap: '1rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontSize: '1.55rem', fontWeight: 800, marginBottom: 4 }}>Pipeline CRM</h1>
          <p style={{ color: '#64748b' }}>Vue commerciale par étape, utile pour l’admin et la réception.</p>
        </div>
        <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
          <Link href="/admin/crm" className="btn btn-secondary">Liste</Link>
          <Link href="/admin/crm/follow-ups" className="btn btn-secondary">Relances</Link>
          <Link href="/admin/crm/new" className="btn btn-primary">Nouveau prospect</Link>
        </div>
      </div>

      {loading ? (
        <div className="card" style={{ padding: '2rem', textAlign: 'center', color: '#64748b' }}>Chargement...</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(260px, 1fr))', gap: '1rem', alignItems: 'start', overflowX: 'auto' }}>
          {PIPELINE_COLUMNS.map((column) => {
            const columnLeads = leads.filter((lead) => lead.status === column.status)
            const style = CRM_STATUS_STYLES[column.status]
            return (
              <section key={column.status} className="card" style={{ minWidth: 260, display: 'grid', gap: '0.85rem', background: '#fcfcfd' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', alignItems: 'center' }}>
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ width: 10, height: 10, borderRadius: 999, background: style.text, display: 'inline-block' }} />
                    <strong>{column.title}</strong>
                  </div>
                  <span style={{ background: style.bg, color: style.text, padding: '0.22rem 0.55rem', borderRadius: 999, fontSize: '0.8rem', fontWeight: 700 }}>
                    {columnLeads.length}
                  </span>
                </div>

                {columnLeads.length === 0 ? (
                  <div style={{ color: '#64748b', fontSize: '0.9rem' }}>Aucun prospect.</div>
                ) : columnLeads.map((lead) => (
                  <article key={lead.id} style={{ border: '1px solid #e2e8f0', borderRadius: 16, padding: '0.9rem', background: '#fff', display: 'grid', gap: '0.75rem' }}>
                    <div>
                      <div style={{ fontWeight: 800, marginBottom: 4 }}>{lead.parent_name}</div>
                      <div style={{ color: '#334155', fontSize: '0.92rem' }}>{lead.student_name}</div>
                      <div style={{ color: '#64748b', fontSize: '0.82rem', marginTop: 4 }}>
                        {lead.program_interest || 'Programme non précisé'} · {lead.source || 'Source inconnue'}
                      </div>
                    </div>

                    <div style={{ color: '#64748b', fontSize: '0.83rem' }}>
                      Relance : {formatDateTime(lead.next_follow_up_at)}
                    </div>

                    <div style={{ display: 'grid', gap: '0.55rem' }}>
                      <select
                        className="input"
                        value={lead.status}
                        onChange={async (event) => {
                          const nextStatus = event.target.value as CrmLead['status']
                          const result = await updateCrmLeadStatus(lead.id, nextStatus)
                          if (result.error) {
                            window.alert(result.error)
                            return
                          }
                          await loadData()
                        }}
                      >
                        {CRM_STATUS_OPTIONS.filter((option) => option.value !== 'no_response').map((option) => (
                          <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                      </select>

                      <CrmQuickActions lead={lead} templates={templates} compact />
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem' }}>
                      <span style={{ color: '#64748b', fontSize: '0.82rem' }}>{lead.assignee?.full_name || 'Non assigné'}</span>
                      <Link href={`/admin/crm/${lead.id}`} className="btn btn-secondary btn-sm">Ouvrir</Link>
                    </div>
                  </article>
                ))}
              </section>
            )
          })}
        </div>
      )}
    </div>
  )
}
