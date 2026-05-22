'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { getHotCrmLeads, getCrmMessageTemplates } from '@/lib/actions'
import type { CrmMessageTemplate, CrmScoredLead } from '@/lib/types'
import { CrmQuickActions } from '../components/CrmQuickActions'

const temperatureStyle = {
  hot: { bg: '#fee2e2', text: '#b91c1c' },
  warm: { bg: '#fef3c7', text: '#b45309' },
  cold: { bg: '#dbeafe', text: '#1d4ed8' },
} as const

export default function CrmHotLeadsPage() {
  const [loading, setLoading] = useState(true)
  const [leads, setLeads] = useState<CrmScoredLead[]>([])
  const [templates, setTemplates] = useState<CrmMessageTemplate[]>([])

  useEffect(() => {
    let active = true
    async function bootstrap() {
      const [leadData, templateData] = await Promise.all([
        getHotCrmLeads(),
        getCrmMessageTemplates(),
      ])
      if (!active) return
      setLeads(leadData)
      setTemplates(templateData)
      setLoading(false)
    }
    void bootstrap()
    return () => {
      active = false
    }
  }, [])

  return (
    <div style={{ display: 'grid', gap: '1rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontSize: '1.55rem', fontWeight: 800, marginBottom: 4 }}>Prospects chauds</h1>
          <p style={{ color: '#64748b' }}>Scoring automatique pour prioriser les conversions commerciales.</p>
        </div>
        <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
          <Link href="/admin/crm" className="btn btn-secondary">Liste</Link>
          <Link href="/admin/crm/pipeline" className="btn btn-secondary">Pipeline</Link>
          <Link href="/admin/crm/analytics" className="btn btn-secondary">Analytics</Link>
        </div>
      </div>

      {loading ? (
        <div className="card" style={{ padding: '2rem', textAlign: 'center', color: '#64748b' }}>Chargement...</div>
      ) : leads.length === 0 ? (
        <div className="card" style={{ padding: '2rem', textAlign: 'center', color: '#64748b' }}>Aucun prospect chaud pour le moment.</div>
      ) : (
        <div style={{ display: 'grid', gap: '1rem' }}>
          {leads.map((entry) => {
            const tone = temperatureStyle[entry.temperature]
            return (
              <article key={entry.lead_id} className="card" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1.1fr auto', gap: '1rem', alignItems: 'start' }}>
                <div>
                  <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', marginBottom: 6 }}>
                    <strong>{entry.lead.parent_name}</strong>
                    <span style={{ background: tone.bg, color: tone.text, padding: '0.25rem 0.55rem', borderRadius: 999, fontSize: '0.8rem', fontWeight: 700 }}>
                      {entry.temperature.toUpperCase()}
                    </span>
                    <span style={{ color: tone.text, fontWeight: 800 }}>{entry.score}/100</span>
                  </div>
                  <div style={{ color: '#334155' }}>{entry.lead.student_name}</div>
                  <div style={{ color: '#64748b', fontSize: '0.84rem', marginTop: 4 }}>
                    {entry.lead.program_interest || 'Programme non précisé'} · {entry.lead.source || 'Source inconnue'}
                  </div>
                </div>

                <div>
                  <div style={{ fontWeight: 700, marginBottom: 6 }}>Facteurs</div>
                  <div style={{ display: 'grid', gap: '0.35rem' }}>
                    {entry.score_factors.map((factor, index) => (
                      <div key={`${entry.lead_id}-${index}`} style={{ fontSize: '0.85rem', color: factor.score > 0 ? '#0f766e' : '#b91c1c' }}>
                        {factor.score > 0 ? '+' : ''}{factor.score} · {factor.label}
                      </div>
                    ))}
                  </div>
                </div>

                <CrmQuickActions lead={entry.lead} templates={templates} />

                <Link href={`/admin/crm/${entry.lead_id}`} className="btn btn-secondary btn-sm">Ouvrir</Link>
              </article>
            )
          })}
        </div>
      )}
    </div>
  )
}
