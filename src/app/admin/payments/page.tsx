'use client'

import { useState } from 'react'
import { getTeacherReports } from '@/lib/actions'
import { generateCsv, downloadCsv } from '@/lib/utils'
import type { TeacherReport } from '@/lib/types'
import { CreditCard, Download, Loader2, Calendar } from 'lucide-react'

function formatMad(value: number): string {
  return `${value.toLocaleString('fr-MA', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} MAD`
}

export default function PaymentsPage() {
  const [reports, setReports] = useState<TeacherReport[]>([])
  const [loading, setLoading] = useState(false)
  const [month, setMonth] = useState(() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  })

  const fetchPayments = async () => {
    setLoading(true)
    const [year, m] = month.split('-').map(Number)
    const dateFrom = new Date(year, m - 1, 1).toISOString().split('T')[0]
    const dateTo = new Date(year, m, 0).toISOString().split('T')[0]

    const data = await getTeacherReports({ dateFrom, dateTo })
    setReports(data)
    setLoading(false)
  }

  const handleExportCsv = () => {
    const headers = ['Professeur', 'Heures totales', 'Taux horaire (MAD)', 'Montant à payer (MAD)']
    const rows = reports.map((r) => [
      r.teacher_name,
      String(r.total_hours),
      formatMad(r.hourly_rate),
      formatMad(r.estimated_payment),
    ])
    const csv = generateCsv(headers, rows)
    downloadCsv(csv, `paiements_${month}.csv`)
  }

  const totalPayment = reports.reduce((sum, r) => sum + r.estimated_payment, 0)

  const monthLabel = (() => {
    const [year, m] = month.split('-').map(Number)
    return new Date(year, m - 1).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
  })()

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '0.75rem' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 800 }}>Paiements</h1>
        {reports.length > 0 && (
          <button className="btn btn-secondary" onClick={handleExportCsv}>
            <Download size={16} /> Exporter CSV
          </button>
        )}
      </div>

      {/* Month selector */}
      <div className="card" style={{ marginBottom: '1.5rem', display: 'flex', gap: '0.75rem', alignItems: 'end', flexWrap: 'wrap' }}>
        <div>
          <label style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>
            <Calendar size={14} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} />
            Mois
          </label>
          <input className="input" type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
        </div>
        <button className="btn btn-primary" onClick={fetchPayments}>
          <CreditCard size={16} /> Calculer les paiements
        </button>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem' }}>
          <Loader2 size={32} style={{ margin: '0 auto', animation: 'spin 1s linear infinite', color: '#6366f1' }} />
        </div>
      ) : reports.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '2.5rem', color: '#64748b' }}>
          Sélectionnez un mois et cliquez sur &quot;Calculer les paiements&quot;.
        </div>
      ) : (
        <>
          {/* Total */}
          <div className="card" style={{
            background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
            color: 'white',
            textAlign: 'center',
            marginBottom: '1.5rem',
          }}>
            <p style={{ fontSize: '0.875rem', opacity: 0.9, marginBottom: '0.25rem' }}>
              Total des paiements · {monthLabel}
            </p>
            <p style={{ fontSize: '2.5rem', fontWeight: 800 }}>{formatMad(totalPayment)}</p>
          </div>

          {/* Payment cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem' }}>
            {reports.map((r) => (
              <div key={r.teacher_id} className="card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '0.75rem' }}>
                  <p style={{ fontWeight: 700, fontSize: '1rem' }}>{r.teacher_name}</p>
                  <span style={{ fontSize: '1.25rem', fontWeight: 800, color: '#10b981' }}>
                    {formatMad(r.estimated_payment)}
                  </span>
                </div>
                <div style={{ display: 'flex', gap: '1.5rem', fontSize: '0.8125rem', color: '#64748b' }}>
                  <span>{r.total_hours.toFixed(1)}h travaillées</span>
                  <span>×</span>
                  <span>{formatMad(r.hourly_rate)} / h</span>
                </div>
                <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '0.5rem' }}>
                  {r.total_sessions} session{r.total_sessions > 1 ? 's' : ''}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
