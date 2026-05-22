'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { getCrmAnalyticsSummary, getCrmSourceStats, getHotCrmLeads } from '@/lib/actions'
import type { CrmAnalyticsSummary, CrmScoredLead, CrmSourceStat } from '@/lib/types'

export default function CrmAnalyticsPage() {
  const [loading, setLoading] = useState(true)
  const [summary, setSummary] = useState<CrmAnalyticsSummary | null>(null)
  const [sources, setSources] = useState<CrmSourceStat[]>([])
  const [hotLeads, setHotLeads] = useState<CrmScoredLead[]>([])

  useEffect(() => {
    let active = true
    async function bootstrap() {
      const [summaryData, sourceData, hotLeadData] = await Promise.all([
        getCrmAnalyticsSummary(),
        getCrmSourceStats(),
        getHotCrmLeads(),
      ])
      if (!active) return
      setSummary(summaryData)
      setSources(sourceData)
      setHotLeads(hotLeadData)
      setLoading(false)
    }
    void bootstrap()
    return () => {
      active = false
    }
  }, [])

  const cards = [
    { label: 'Total prospects', value: summary?.totalLeads ?? 0 },
    { label: 'Prospects chauds', value: summary?.hotLeads ?? 0 },
    { label: 'Prospects tièdes', value: summary?.warmLeads ?? 0 },
    { label: 'Prospects froids', value: summary?.coldLeads ?? 0 },
    { label: 'Taux de conversion', value: `${summary?.conversionRate ?? 0}%` },
    { label: 'Cas impayés', value: summary?.overduePaymentCases ?? 0 },
    { label: 'Promesses de paiement', value: summary?.promisedPaymentCases ?? 0 },
  ]

  return (
    <div style={{ display: 'grid', gap: '1rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontSize: '1.55rem', fontWeight: 800, marginBottom: 4 }}>Analytics CRM</h1>
          <p style={{ color: '#64748b' }}>Pilotage des sources, du scoring commercial et du risque paiement.</p>
        </div>
        <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
          <Link href="/admin/crm" className="btn btn-secondary">Liste</Link>
          <Link href="/admin/crm/hot-leads" className="btn btn-secondary">Hot leads</Link>
          <Link href="/admin/crm/payment-followups" className="btn btn-secondary">Recouvrement</Link>
        </div>
      </div>

      {loading ? (
        <div className="card" style={{ padding: '2rem', textAlign: 'center', color: '#64748b' }}>Chargement...</div>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.9rem' }}>
            {cards.map((card) => (
              <div key={card.label} className="card">
                <div style={{ fontSize: '0.84rem', color: '#64748b', marginBottom: 8 }}>{card.label}</div>
                <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#0f172a' }}>{card.value}</div>
              </div>
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div className="card">
              <h2 style={{ fontSize: '1.05rem', fontWeight: 800, marginBottom: '0.9rem' }}>Top sources</h2>
              <div style={{ display: 'grid', gap: '0.75rem' }}>
                {sources.slice(0, 8).map((source) => {
                  const rate = source.total ? Math.round((source.enrolled / source.total) * 100) : 0
                  return (
                    <div key={source.source} style={{ display: 'grid', gap: '0.25rem', borderBottom: '1px solid #f1f5f9', paddingBottom: '0.6rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem' }}>
                        <strong>{source.source}</strong>
                        <span style={{ color: '#64748b' }}>{source.total} lead(s)</span>
                      </div>
                      <div style={{ color: '#64748b', fontSize: '0.84rem' }}>
                        {source.enrolled} inscrit(s) · {source.lost} perdu(s) · {rate}% conversion
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            <div className="card">
              <h2 style={{ fontSize: '1.05rem', fontWeight: 800, marginBottom: '0.9rem' }}>Top prospects chauds</h2>
              <div style={{ display: 'grid', gap: '0.75rem' }}>
                {hotLeads.slice(0, 8).map((entry) => (
                  <div key={entry.lead_id} style={{ display: 'grid', gap: '0.25rem', borderBottom: '1px solid #f1f5f9', paddingBottom: '0.6rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem' }}>
                      <strong>{entry.lead.parent_name}</strong>
                      <span style={{ color: '#b91c1c', fontWeight: 800 }}>{entry.score}/100</span>
                    </div>
                    <div style={{ color: '#334155', fontSize: '0.9rem' }}>{entry.lead.student_name}</div>
                    <div style={{ color: '#64748b', fontSize: '0.84rem' }}>
                      {entry.lead.program_interest || 'Programme non précisé'} · {entry.lead.source || 'Source inconnue'}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
