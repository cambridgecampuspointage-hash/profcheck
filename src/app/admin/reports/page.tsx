'use client'

import { useState } from 'react'
import { getTeacherReports } from '@/lib/actions'
import { generateCsv, downloadCsv } from '@/lib/utils'
import type { TeacherReport } from '@/lib/types'
import { BarChart3, Download, Loader2 } from 'lucide-react'

export default function ReportsPage() {
  const [reports, setReports] = useState<TeacherReport[]>([])
  const [loading, setLoading] = useState(false)
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [preset, setPreset] = useState('')

  const applyPreset = (type: string) => {
    setPreset(type)
    const now = new Date()
    let from: Date
    const to = new Date(now)

    switch (type) {
      case 'day':
        from = new Date(now.getFullYear(), now.getMonth(), now.getDate())
        break
      case 'week': {
        const dayOfWeek = now.getDay()
        const diff = dayOfWeek === 0 ? 6 : dayOfWeek - 1
        from = new Date(now.getFullYear(), now.getMonth(), now.getDate() - diff)
        break
      }
      case 'month':
        from = new Date(now.getFullYear(), now.getMonth(), 1)
        break
      default:
        return
    }

    setDateFrom(from.toISOString().split('T')[0])
    setDateTo(to.toISOString().split('T')[0])
  }

  const fetchReports = async () => {
    if (!dateFrom || !dateTo) return
    setLoading(true)
    const data = await getTeacherReports({ dateFrom, dateTo })
    setReports(data)
    setLoading(false)
  }

  const handleExportCsv = () => {
    const headers = ['Professeur', 'Sessions', 'Heures totales', 'Taux horaire (€)', 'Paiement estimé (€)']
    const rows = reports.map((r) => [
      r.teacher_name,
      String(r.total_sessions),
      String(r.total_hours),
      String(r.hourly_rate),
      String(r.estimated_payment),
    ])
    const csv = generateCsv(headers, rows)
    downloadCsv(csv, `rapport_${dateFrom}_${dateTo}.csv`)
  }

  const totalHours = reports.reduce((sum, r) => sum + r.total_hours, 0)
  const totalPayment = reports.reduce((sum, r) => sum + r.estimated_payment, 0)

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '0.75rem' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 800 }}>Rapports</h1>
        {reports.length > 0 && (
          <button className="btn btn-secondary" onClick={handleExportCsv}>
            <Download size={16} /> Exporter CSV
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
          {[
            { key: 'day', label: "Aujourd'hui" },
            { key: 'week', label: 'Cette semaine' },
            { key: 'month', label: 'Ce mois' },
          ].map((p) => (
            <button
              key={p.key}
              className={`btn btn-sm ${preset === p.key ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => applyPreset(p.key)}
            >
              {p.label}
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'end' }}>
          <div>
            <label style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>Du</label>
            <input className="input" type="date" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setPreset('') }} />
          </div>
          <div>
            <label style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>Au</label>
            <input className="input" type="date" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setPreset('') }} />
          </div>
          <button className="btn btn-primary" onClick={fetchReports} disabled={!dateFrom || !dateTo}>
            <BarChart3 size={16} /> Générer le rapport
          </button>
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem' }}>
          <Loader2 size={32} style={{ margin: '0 auto', animation: 'spin 1s linear infinite', color: '#6366f1' }} />
        </div>
      ) : reports.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '2.5rem', color: '#64748b' }}>
          Sélectionnez une période et cliquez sur &quot;Générer le rapport&quot;.
        </div>
      ) : (
        <>
          {/* Summary */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
            <div className="card" style={{ textAlign: 'center' }}>
              <p style={{ fontSize: '2rem', fontWeight: 800, color: '#6366f1' }}>{totalHours.toFixed(1)}h</p>
              <p style={{ color: '#64748b', fontSize: '0.8125rem' }}>Heures totales</p>
            </div>
            <div className="card" style={{ textAlign: 'center' }}>
              <p style={{ fontSize: '2rem', fontWeight: 800, color: '#10b981' }}>{totalPayment.toFixed(2)}€</p>
              <p style={{ color: '#64748b', fontSize: '0.8125rem' }}>Paiement total estimé</p>
            </div>
            <div className="card" style={{ textAlign: 'center' }}>
              <p style={{ fontSize: '2rem', fontWeight: 800, color: '#f59e0b' }}>{reports.length}</p>
              <p style={{ color: '#64748b', fontSize: '0.8125rem' }}>Professeurs</p>
            </div>
          </div>

          {/* Table */}
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Professeur</th>
                  <th>Sessions</th>
                  <th>Heures totales</th>
                  <th>Taux horaire</th>
                  <th>Paiement estimé</th>
                </tr>
              </thead>
              <tbody>
                {reports.map((r) => (
                  <tr key={r.teacher_id}>
                    <td style={{ fontWeight: 600 }}>{r.teacher_name}</td>
                    <td>{r.total_sessions}</td>
                    <td>{r.total_hours.toFixed(1)}h</td>
                    <td>{r.hourly_rate}€/h</td>
                    <td style={{ fontWeight: 600, color: '#10b981' }}>{r.estimated_payment.toFixed(2)}€</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}
