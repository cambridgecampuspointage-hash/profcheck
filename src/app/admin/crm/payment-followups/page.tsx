'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { getCrmPaymentFollowups, updateCrmPaymentFollowup } from '@/lib/actions'
import type { CrmPaymentFollowup, CrmPaymentFollowupStatus } from '@/lib/types'

const statusLabels: Record<CrmPaymentFollowupStatus, string> = {
  overdue: 'En retard',
  promised: 'Promesse',
  resolved: 'Réglé',
  blocked: 'Bloqué',
}

export default function CrmPaymentFollowupsPage() {
  const [loading, setLoading] = useState(true)
  const [followups, setFollowups] = useState<CrmPaymentFollowup[]>([])

  const loadData = async () => {
    const data = await getCrmPaymentFollowups()
    setFollowups(data)
    setLoading(false)
  }

  useEffect(() => {
    let active = true
    async function bootstrap() {
      const data = await getCrmPaymentFollowups()
      if (!active) return
      setFollowups(data)
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
          <h1 style={{ fontSize: '1.55rem', fontWeight: 800, marginBottom: 4 }}>Recouvrement CRM</h1>
          <p style={{ color: '#64748b' }}>Suivi des étudiants convertis avec paiement en retard ou promesse en cours.</p>
        </div>
        <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
          <Link href="/admin/crm" className="btn btn-secondary">Liste</Link>
          <Link href="/admin/crm/hot-leads" className="btn btn-secondary">Hot leads</Link>
          <Link href="/admin/crm/analytics" className="btn btn-secondary">Analytics</Link>
        </div>
      </div>

      {loading ? (
        <div className="card" style={{ padding: '2rem', textAlign: 'center', color: '#64748b' }}>Chargement...</div>
      ) : followups.length === 0 ? (
        <div className="card" style={{ padding: '2rem', textAlign: 'center', color: '#64748b' }}>Aucun suivi paiement pour le moment.</div>
      ) : (
        <div style={{ display: 'grid', gap: '0.9rem' }}>
          {followups.map((followup) => (
            <article key={followup.id} className="card" style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr auto auto', gap: '1rem', alignItems: 'start' }}>
              <div>
                <strong>{followup.student?.full_name || 'Étudiant inconnu'}</strong>
                <div style={{ color: '#64748b', fontSize: '0.85rem', marginTop: 4 }}>
                  Parent : {followup.lead?.parent_name || followup.student?.parent_name || '—'}
                </div>
                <div style={{ color: '#64748b', fontSize: '0.85rem', marginTop: 4 }}>
                  Échéance : {followup.student?.payment_due_date || '—'}
                </div>
                {followup.promised_payment_date ? (
                  <div style={{ color: '#0f766e', fontSize: '0.85rem', marginTop: 4 }}>
                    Promesse : {followup.promised_payment_date}
                  </div>
                ) : null}
                {followup.notes ? (
                  <div style={{ color: '#334155', fontSize: '0.85rem', marginTop: 6 }}>{followup.notes}</div>
                ) : null}
              </div>

              <div>
                <div style={{ fontWeight: 700, marginBottom: 4 }}>{statusLabels[followup.status]}</div>
                <div style={{ color: '#64748b', fontSize: '0.84rem' }}>
                  Mis à jour : {new Date(followup.updated_at).toLocaleString('fr-FR')}
                </div>
              </div>

              <select
                className="input"
                value={followup.status}
                onChange={async (event) => {
                  const nextStatus = event.target.value as CrmPaymentFollowupStatus
                  const promisedDate = nextStatus === 'promised'
                    ? window.prompt('Date promise de paiement (YYYY-MM-DD) :', followup.promised_payment_date || '')
                    : null
                  const note = nextStatus === 'promised'
                    ? window.prompt('Note / promesse de paiement :', followup.notes || '')
                    : followup.notes

                  const result = await updateCrmPaymentFollowup(followup.id, {
                    status: nextStatus,
                    promised_payment_date: nextStatus === 'promised' ? promisedDate || null : null,
                    notes: note || null,
                  })

                  if (result.error) {
                    window.alert(result.error)
                    return
                  }

                  await loadData()
                }}
              >
                {Object.entries(statusLabels).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>

              {followup.lead_id ? (
                <Link href={`/admin/crm/${followup.lead_id}`} className="btn btn-secondary btn-sm">Fiche CRM</Link>
              ) : (
                <span style={{ color: '#94a3b8', fontSize: '0.85rem' }}>Sans fiche CRM</span>
              )}
            </article>
          ))}
        </div>
      )}
    </div>
  )
}
