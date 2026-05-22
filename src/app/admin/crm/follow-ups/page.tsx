'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getCrmMessageTemplates, getCrmSourceStats } from '@/lib/actions'
import type { CrmLead, CrmMessageTemplate } from '@/lib/types'
import { CrmQuickActions } from '../components/CrmQuickActions'
import { CRM_STATUS_OPTIONS, CRM_STATUS_STYLES, formatDateTime } from '../components/crm-config'

type Bucket = 'today' | 'overdue' | 'tomorrow' | 'stale'

export default function CrmFollowUpsPage() {
  const supabase = useMemo(() => createClient(), [])
  const [loading, setLoading] = useState(true)
  const [leads, setLeads] = useState<CrmLead[]>([])
  const [templates, setTemplates] = useState<CrmMessageTemplate[]>([])
  const [referenceNow, setReferenceNow] = useState<string | null>(null)
  const [status, setStatus] = useState<'all' | CrmLead['status']>('all')
  const [source, setSource] = useState('all')
  const [sources, setSources] = useState<string[]>([])

  useEffect(() => {
    let active = true
    async function bootstrap() {
      const [leadRes, templateData, sourceStats] = await Promise.all([
        supabase
          .from('crm_leads')
          .select('*, center:centers(*), assignee:profiles!crm_leads_assigned_to_fkey(id, full_name, role), student:students(*)')
          .order('next_follow_up_at', { ascending: true }),
        getCrmMessageTemplates(),
        getCrmSourceStats(),
      ])

      if (!active) return
      setLeads((leadRes.data || []) as CrmLead[])
      setTemplates(templateData)
      setSources(sourceStats.map((entry) => entry.source))
      setReferenceNow(new Date().toISOString())
      setLoading(false)
    }
    void bootstrap()
    return () => {
      active = false
    }
  }, [supabase])

  const filteredLeads = useMemo(() => {
    return leads.filter((lead) => {
      const matchesStatus = status === 'all' || lead.status === status
      const matchesSource = source === 'all' || (lead.source || 'Source inconnue') === source
      return matchesStatus && matchesSource
    })
  }, [leads, status, source])

  const buckets = useMemo(() => {
    const now = referenceNow ? new Date(referenceNow) : new Date('2000-01-01T00:00:00.000Z')
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1)
    const endOfTomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 2)
    const staleThreshold = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000)

    const map: Record<Bucket, CrmLead[]> = {
      today: [],
      overdue: [],
      tomorrow: [],
      stale: [],
    }

    filteredLeads.forEach((lead) => {
      if (lead.status === 'enrolled' || lead.status === 'lost') return

      if (lead.next_follow_up_at) {
        const followUpDate = new Date(lead.next_follow_up_at)
        if (followUpDate >= startOfToday && followUpDate < endOfToday) map.today.push(lead)
        else if (followUpDate < startOfToday) map.overdue.push(lead)
        else if (followUpDate >= endOfToday && followUpDate < endOfTomorrow) map.tomorrow.push(lead)
      }

      const lastTouch = lead.last_contact_at ? new Date(lead.last_contact_at) : new Date(lead.created_at)
      if (lastTouch < staleThreshold && lead.status !== 'no_response') {
        map.stale.push(lead)
      }
    })

    return map
  }, [filteredLeads, referenceNow])

  const sections: Array<{ key: Bucket; title: string; tone: string }> = [
    { key: 'today', title: 'Relances aujourd’hui', tone: '#1d4ed8' },
    { key: 'overdue', title: 'Relances en retard', tone: '#c2410c' },
    { key: 'tomorrow', title: 'Relances demain', tone: '#0f766e' },
    { key: 'stale', title: 'Sans réponse depuis 3 jours', tone: '#7c3aed' },
  ]

  return (
    <div style={{ display: 'grid', gap: '1rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontSize: '1.55rem', fontWeight: 800, marginBottom: 4 }}>Relances CRM</h1>
          <p style={{ color: '#64748b' }}>Vue opérationnelle des relances à traiter par priorité.</p>
        </div>
        <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
          <Link href="/admin/crm" className="btn btn-secondary">Liste</Link>
          <Link href="/admin/crm/pipeline" className="btn btn-secondary">Pipeline</Link>
          <Link href="/admin/crm/new" className="btn btn-primary">Nouveau prospect</Link>
        </div>
      </div>

      <div className="card" style={{ display: 'grid', gridTemplateColumns: '1fr 240px 240px', gap: '1rem' }}>
        <div style={{ color: '#334155', display: 'flex', alignItems: 'center' }}>
          Filtre les relances du jour, en retard, demain ou les prospects chauds non traités.
        </div>
        <select className="input" value={status} onChange={(event) => setStatus(event.target.value as typeof status)}>
          <option value="all">Tous les statuts</option>
          {CRM_STATUS_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
        <select className="input" value={source} onChange={(event) => setSource(event.target.value)}>
          <option value="all">Toutes les sources</option>
          {sources.map((entry) => (
            <option key={entry} value={entry}>{entry}</option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="card" style={{ padding: '2rem', textAlign: 'center', color: '#64748b' }}>Chargement...</div>
      ) : (
        <div style={{ display: 'grid', gap: '1rem' }}>
          {sections.map((section) => (
            <section key={section.key} className="card" style={{ display: 'grid', gap: '0.85rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'center' }}>
                <h2 style={{ fontSize: '1.05rem', fontWeight: 800, color: section.tone }}>{section.title}</h2>
                <span style={{ color: '#64748b' }}>{buckets[section.key].length} prospect(s)</span>
              </div>

              {buckets[section.key].length === 0 ? (
                <div style={{ color: '#64748b' }}>Aucun prospect dans cette section.</div>
              ) : (
                <div style={{ display: 'grid', gap: '0.8rem' }}>
                  {buckets[section.key].map((lead) => {
                    const tone = CRM_STATUS_STYLES[lead.status]
                    return (
                      <article key={`${section.key}-${lead.id}`} style={{ display: 'grid', gridTemplateColumns: '1.1fr 0.9fr 1fr auto', gap: '1rem', border: '1px solid #e2e8f0', borderRadius: 16, padding: '0.9rem', alignItems: 'start' }}>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: 6 }}>
                            <strong>{lead.parent_name}</strong>
                            <span style={{ background: tone.bg, color: tone.text, padding: '0.2rem 0.5rem', borderRadius: 999, fontSize: '0.78rem', fontWeight: 700 }}>
                              {CRM_STATUS_OPTIONS.find((option) => option.value === lead.status)?.label}
                            </span>
                          </div>
                          <div style={{ color: '#334155', marginBottom: 4 }}>{lead.student_name}</div>
                          <div style={{ color: '#64748b', fontSize: '0.84rem' }}>
                            {lead.program_interest || 'Programme non précisé'} · {lead.source || 'Source inconnue'}
                          </div>
                        </div>
                        <div style={{ color: '#64748b', fontSize: '0.88rem' }}>
                          <div>Relance : {formatDateTime(lead.next_follow_up_at)}</div>
                          <div>Dernier contact : {formatDateTime(lead.last_contact_at)}</div>
                          {lead.trial_date ? <div>Test : {formatDateTime(lead.trial_date)}</div> : null}
                        </div>
                        <CrmQuickActions lead={lead} templates={templates} compact />
                        <Link href={`/admin/crm/${lead.id}`} className="btn btn-secondary btn-sm">Ouvrir</Link>
                      </article>
                    )
                  })}
                </div>
              )}
            </section>
          ))}
        </div>
      )}
    </div>
  )
}
