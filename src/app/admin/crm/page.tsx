'use client'

import Link from 'next/link'
import type { CSSProperties } from 'react'
import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getCrmDashboardStats, getCrmMessageTemplates, getCrmSourceStats } from '@/lib/actions'
import type { CrmDashboardStats, CrmLead, CrmMessageTemplate, CrmSourceStat } from '@/lib/types'
import { CrmQuickActions } from './components/CrmQuickActions'
import { CRM_STATUS_OPTIONS, CRM_STATUS_STYLES, formatDateTime } from './components/crm-config'

export default function AdminCrmPage() {
  const supabase = useMemo(() => createClient(), [])
  const [loading, setLoading] = useState(true)
  const [leads, setLeads] = useState<CrmLead[]>([])
  const [stats, setStats] = useState<CrmDashboardStats | null>(null)
  const [sourceStats, setSourceStats] = useState<CrmSourceStat[]>([])
  const [templates, setTemplates] = useState<CrmMessageTemplate[]>([])
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<'all' | CrmLead['status']>('all')

  useEffect(() => {
    let active = true

    async function loadData() {
      const [leadRes, statsRes, sourceStatsRes, templateRes] = await Promise.all([
        supabase
          .from('crm_leads')
          .select('*, center:centers(*), assignee:profiles!crm_leads_assigned_to_fkey(id, full_name, role), student:students(*)')
          .order('created_at', { ascending: false }),
        getCrmDashboardStats(),
        getCrmSourceStats(),
        getCrmMessageTemplates(),
      ])

      if (!active) return
      setLeads((leadRes.data || []) as CrmLead[])
      setStats(statsRes)
      setSourceStats(sourceStatsRes)
      setTemplates(templateRes)
      setLoading(false)
    }

    void loadData()
    return () => {
      active = false
    }
  }, [supabase])

  const filteredLeads = useMemo(() => {
    const query = search.trim().toLowerCase()
    return leads.filter((lead) => {
      const matchesStatus = status === 'all' || lead.status === status
      const haystack = [
        lead.parent_name,
        lead.student_name,
        lead.parent_phone,
        lead.parent_whatsapp,
        lead.program_interest,
        lead.source,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()

      const matchesSearch = !query || haystack.includes(query)
      return matchesStatus && matchesSearch
    })
  }, [leads, search, status])

  const cards = [
    { label: 'Nouveaux cette semaine', value: stats?.newThisWeek ?? 0 },
    { label: 'Relances aujourd’hui', value: stats?.followUpsToday ?? 0 },
    { label: 'Relances en retard', value: stats?.overdueFollowUps ?? 0 },
    { label: 'Tests prévus', value: stats?.trialsScheduled ?? 0 },
    { label: 'Inscriptions du mois', value: stats?.enrolledThisMonth ?? 0 },
    { label: 'Perdus ce mois', value: stats?.lostThisMonth ?? 0 },
  ]

  return (
    <div style={{ display: 'grid', gap: '1.25rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontSize: '1.6rem', fontWeight: 800, marginBottom: 4 }}>CRM prospects</h1>
          <p style={{ color: '#64748b' }}>Parents, prospects, relances et conversion en étudiant.</p>
        </div>
        <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
          <Link href="/admin/crm/pipeline" className="btn btn-secondary">Pipeline</Link>
          <Link href="/admin/crm/follow-ups" className="btn btn-secondary">Relances</Link>
          <Link href="/admin/crm/hot-leads" className="btn btn-secondary">Hot leads</Link>
          <Link href="/admin/crm/payment-followups" className="btn btn-secondary">Recouvrement</Link>
          <Link href="/admin/crm/analytics" className="btn btn-secondary">Analytics</Link>
          <Link href="/admin/crm/new" className="btn btn-primary">Nouveau prospect</Link>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.9rem' }}>
        {cards.map((card) => (
          <div key={card.label} className="card">
            <div style={{ fontSize: '0.84rem', color: '#64748b', marginBottom: 8 }}>{card.label}</div>
            <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#0f172a' }}>{card.value}</div>
          </div>
        ))}
      </div>

      <div className="card" style={{ display: 'grid', gap: '1rem' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 220px', gap: '1rem' }}>
          <input
            className="input"
            placeholder="Rechercher parent, étudiant, téléphone, source..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <select className="input" value={status} onChange={(event) => setStatus(event.target.value as typeof status)}>
            <option value="all">Tous les statuts</option>
            {CRM_STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </div>

        {loading ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: '#64748b' }}>Chargement...</div>
        ) : filteredLeads.length === 0 ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: '#64748b' }}>Aucun prospect trouvé.</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ textAlign: 'left', borderBottom: '1px solid #e2e8f0', color: '#64748b' }}>
                  <th style={thStyle}>Parent</th>
                  <th style={thStyle}>Étudiant</th>
                  <th style={thStyle}>Programme</th>
                  <th style={thStyle}>Source</th>
                  <th style={thStyle}>Statut</th>
                  <th style={thStyle}>Relance</th>
                  <th style={thStyle}>Contact</th>
                  <th style={thStyle}>Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredLeads.map((lead) => {
                  const style = CRM_STATUS_STYLES[lead.status]
                  return (
                    <tr key={lead.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={tdStyle}>
                        <div style={{ fontWeight: 700 }}>{lead.parent_name}</div>
                        <div style={{ color: '#64748b', fontSize: '0.85rem' }}>{lead.parent_phone || lead.parent_whatsapp || '—'}</div>
                      </td>
                      <td style={tdStyle}>
                        <div style={{ fontWeight: 700 }}>{lead.student_name}</div>
                        <div style={{ color: '#64748b', fontSize: '0.85rem' }}>{lead.student_level || 'Niveau non précisé'}</div>
                      </td>
                      <td style={tdStyle}>{lead.program_interest || '—'}</td>
                      <td style={tdStyle}>{lead.source || '—'}</td>
                      <td style={tdStyle}>
                        <span style={{ background: style.bg, color: style.text, padding: '0.3rem 0.6rem', borderRadius: 999, fontSize: '0.8rem', fontWeight: 700 }}>
                          {CRM_STATUS_OPTIONS.find((option) => option.value === lead.status)?.label || lead.status}
                        </span>
                      </td>
                      <td style={tdStyle}>{formatDateTime(lead.next_follow_up_at)}</td>
                      <td style={tdStyle}>
                        <CrmQuickActions lead={lead} templates={templates} compact />
                      </td>
                      <td style={tdStyle}>
                        <Link href={`/admin/crm/${lead.id}`} className="btn btn-secondary btn-sm">Ouvrir</Link>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
        <div className="card">
          <h2 style={{ fontSize: '1.05rem', fontWeight: 800, marginBottom: '0.9rem' }}>Prospects par source</h2>
          {sourceStats.length === 0 ? (
            <div style={{ color: '#64748b' }}>Aucune donnée de source.</div>
          ) : (
            <div style={{ display: 'grid', gap: '0.75rem' }}>
              {sourceStats.slice(0, 6).map((source) => (
                <div key={source.source} style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', borderBottom: '1px solid #f1f5f9', paddingBottom: '0.6rem' }}>
                  <strong>{source.source}</strong>
                  <span style={{ color: '#64748b' }}>{source.total} prospect(s)</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card">
          <h2 style={{ fontSize: '1.05rem', fontWeight: 800, marginBottom: '0.9rem' }}>Conversions par source</h2>
          {sourceStats.length === 0 ? (
            <div style={{ color: '#64748b' }}>Aucune donnée de conversion.</div>
          ) : (
            <div style={{ display: 'grid', gap: '0.75rem' }}>
              {sourceStats.slice(0, 6).map((source) => {
                const rate = source.total ? Math.round((source.enrolled / source.total) * 100) : 0
                return (
                  <div key={source.source} style={{ display: 'grid', gap: '0.35rem', borderBottom: '1px solid #f1f5f9', paddingBottom: '0.6rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem' }}>
                      <strong>{source.source}</strong>
                      <span style={{ color: '#64748b' }}>{rate}% conversion</span>
                    </div>
                    <div style={{ fontSize: '0.85rem', color: '#64748b' }}>
                      {source.enrolled} inscrit(s) · {source.lost} perdu(s)
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

const thStyle: CSSProperties = {
  padding: '0.85rem 0.7rem',
  fontWeight: 700,
  fontSize: '0.82rem',
}

const tdStyle: CSSProperties = {
  padding: '0.9rem 0.7rem',
  verticalAlign: 'top',
  fontSize: '0.92rem',
}
