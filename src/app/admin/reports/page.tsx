'use client'

import { useEffect, useState } from 'react'
import { getTeacherReports, getTeachers } from '@/lib/actions'
import { buildPayrollCsv, downloadCsv, payrollFilename } from '@/lib/csv'
import type { Teacher, TeacherReport } from '@/lib/types'
import { ArrowDownAZ, BarChart3, Download, Loader2, Search } from 'lucide-react'

function formatMad(value: number): string {
  return `${value.toLocaleString('fr-MA', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} MAD`
}

export default function ReportsPage() {
  const [reports, setReports] = useState<TeacherReport[]>([])
  const [teachers, setTeachers] = useState<Teacher[]>([])
  const [loading, setLoading] = useState(false)
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [preset, setPreset] = useState('')
  const [teacherId, setTeacherId] = useState('')
  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState<'name' | 'hours' | 'payment' | 'sessions'>('hours')

  useEffect(() => {
    let active = true

    async function loadTeachers() {
      const data = await getTeachers()
      if (!active) return
      setTeachers(data as Teacher[])
    }

    void loadTeachers()

    return () => {
      active = false
    }
  }, [])

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
    const data = await getTeacherReports({ dateFrom, dateTo, teacherId: teacherId || undefined })
    setReports(data)
    setLoading(false)
  }

  const handleExportCsv = () => {
    const selectedTeacher = teachers.find((teacher) => teacher.id === teacherId)
    const csv = buildPayrollCsv({
      teacherName: selectedTeacher?.full_name ?? 'Tous',
      dateFrom,
      dateTo,
      rows: filteredReports.map((report) => ({
        teacher_name: report.teacher_name,
        total_sessions: report.total_sessions,
        total_hours: report.total_hours,
        hourly_rate: report.hourly_rate,
        estimated_payment: report.estimated_payment,
      })),
    })

    downloadCsv(csv, payrollFilename(dateFrom, dateTo))
  }

  const filteredReports = [...reports]
    .filter((report) =>
      report.teacher_name.toLowerCase().includes(search.trim().toLowerCase())
    )
    .sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return a.teacher_name.localeCompare(b.teacher_name, 'fr')
        case 'payment':
          return b.estimated_payment - a.estimated_payment
        case 'sessions':
          return b.total_sessions - a.total_sessions
        case 'hours':
        default:
          return b.total_hours - a.total_hours
      }
    })

  const totalHours = filteredReports.reduce((sum, r) => sum + r.total_hours, 0)
  const totalPayment = filteredReports.reduce((sum, r) => sum + r.estimated_payment, 0)

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '0.75rem' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 800 }}>Rapports</h1>
        {filteredReports.length > 0 && (
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
            <label style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>Professeur</label>
            <select className="input" value={teacherId} onChange={(e) => setTeacherId(e.target.value)} style={{ minWidth: 240 }}>
              <option value="">Tous les professeurs</option>
              {teachers.map((teacher) => (
                <option key={teacher.id} value={teacher.id}>{teacher.full_name}</option>
              ))}
            </select>
          </div>
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
          <div className="card" style={{ marginBottom: '1.25rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(240px, 1fr) minmax(200px, 260px)', gap: '0.75rem' }}>
              <div style={{ position: 'relative' }}>
                <Search size={16} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                <input
                  className="input"
                  style={{ paddingLeft: '2.5rem' }}
                  placeholder="Chercher un professeur..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <div style={{ position: 'relative' }}>
                <ArrowDownAZ size={16} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', pointerEvents: 'none' }} />
                <select
                  className="input"
                  style={{ paddingLeft: '2.5rem' }}
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as 'name' | 'hours' | 'payment' | 'sessions')}
                >
                  <option value="hours">Trier par heures</option>
                  <option value="payment">Trier par paiement</option>
                  <option value="sessions">Trier par sessions</option>
                  <option value="name">Trier par nom</option>
                </select>
              </div>
            </div>
          </div>

          {/* Summary */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
            <div className="card" style={{ textAlign: 'center' }}>
              <p style={{ fontSize: '2rem', fontWeight: 800, color: '#6366f1' }}>{totalHours.toFixed(1)}h</p>
              <p style={{ color: '#64748b', fontSize: '0.8125rem' }}>Heures totales</p>
            </div>
            <div className="card" style={{ textAlign: 'center' }}>
              <p style={{ fontSize: '2rem', fontWeight: 800, color: '#10b981' }}>{formatMad(totalPayment)}</p>
              <p style={{ color: '#64748b', fontSize: '0.8125rem' }}>Paiement total estimé</p>
            </div>
            <div className="card" style={{ textAlign: 'center' }}>
              <p style={{ fontSize: '2rem', fontWeight: 800, color: '#f59e0b' }}>{filteredReports.length}</p>
              <p style={{ color: '#64748b', fontSize: '0.8125rem' }}>Professeurs affichés</p>
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
                {filteredReports.map((r) => (
                  <tr key={r.teacher_id}>
                    <td style={{ fontWeight: 600 }}>{r.teacher_name}</td>
                    <td>{r.total_sessions}</td>
                    <td>{r.total_hours.toFixed(1)}h</td>
                    <td>{formatMad(r.hourly_rate)} / h</td>
                    <td style={{ fontWeight: 600, color: '#10b981' }}>{formatMad(r.estimated_payment)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {filteredReports.length === 0 && (
            <div className="card" style={{ textAlign: 'center', padding: '1.5rem', color: '#64748b', marginTop: '1rem' }}>
              Aucun professeur ne correspond à cette recherche.
            </div>
          )}
        </>
      )}
    </div>
  )
}
