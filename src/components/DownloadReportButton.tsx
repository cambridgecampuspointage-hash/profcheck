'use client'

import { useMemo, useState, useTransition } from 'react'
import { CalendarDays, Download, FileText, Loader2 } from 'lucide-react'
import { getMyTeacherReportData } from '@/lib/actions'

function toInputDate(date: Date): string {
  return date.toISOString().split('T')[0]
}

function currentMonthRange() {
  const now = new Date()
  return {
    from: toInputDate(new Date(now.getFullYear(), now.getMonth(), 1)),
    to: toInputDate(now),
  }
}

export function DownloadReportButton() {
  const defaults = useMemo(() => currentMonthRange(), [])
  const [dateFrom, setDateFrom] = useState(defaults.from)
  const [dateTo, setDateTo] = useState(defaults.to)
  const [error, setError] = useState('')
  const [isPending, startTransition] = useTransition()

  const applyPreset = (preset: 'today' | 'week' | 'month') => {
    const now = new Date()
    let from = new Date(now)

    if (preset === 'today') {
      from = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    } else if (preset === 'week') {
      const dayOfWeek = now.getDay()
      const diff = dayOfWeek === 0 ? 6 : dayOfWeek - 1
      from = new Date(now.getFullYear(), now.getMonth(), now.getDate() - diff)
    } else {
      from = new Date(now.getFullYear(), now.getMonth(), 1)
    }

    setDateFrom(toInputDate(from))
    setDateTo(toInputDate(now))
  }

  const handleDownload = () => {
    if (!dateFrom || !dateTo) {
      setError('Choisissez une période valide.')
      return
    }

    if (dateFrom > dateTo) {
      setError('La date de début doit être antérieure à la date de fin.')
      return
    }

    setError('')

    startTransition(async () => {
      const result = await getMyTeacherReportData(dateFrom, dateTo)
      if (result.error || !result.data) {
        setError(result.error || 'Impossible de générer le rapport.')
        return
      }

      const { generateTeacherReportPdf } = await import('@/lib/pdf/generateTeacherReport')
      await generateTeacherReportPdf(result.data)
    })
  }

  return (
    <div className="brand-card brand-card-pad">
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.9rem', marginBottom: '1rem' }}>
        <div
          style={{
            width: 42,
            height: 42,
            borderRadius: 14,
            background: 'var(--brand-gold-soft)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <FileText size={18} color="var(--brand-navy)" />
        </div>
        <div>
          <div
            style={{
              fontFamily: 'var(--font-serif-brand)',
              color: 'var(--brand-navy)',
              fontSize: '1.1rem',
              fontWeight: 700,
              marginBottom: '0.25rem',
            }}
          >
            Mon rapport PDF
          </div>
          <div style={{ color: 'var(--brand-muted)', fontSize: '0.92rem', lineHeight: 1.5 }}>
            Téléchargez un rapport propre et imprimable avec vos séances, vos heures validées et
            une estimation de rémunération sur la période choisie.
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
        <button type="button" className="btn btn-secondary btn-sm" onClick={() => applyPreset('today')}>
          Aujourd&apos;hui
        </button>
        <button type="button" className="btn btn-secondary btn-sm" onClick={() => applyPreset('week')}>
          Cette semaine
        </button>
        <button type="button" className="btn btn-secondary btn-sm" onClick={() => applyPreset('month')}>
          Ce mois
        </button>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: '0.85rem',
          alignItems: 'end',
        }}
      >
        <div>
          <label
            style={{
              display: 'block',
              marginBottom: 6,
              color: 'var(--brand-navy)',
              fontSize: '0.82rem',
              fontWeight: 700,
            }}
          >
            Du
          </label>
          <div style={{ position: 'relative' }}>
            <CalendarDays
              size={16}
              style={{
                position: 'absolute',
                left: 14,
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--brand-muted)',
                pointerEvents: 'none',
              }}
            />
            <input
              className="input"
              type="date"
              value={dateFrom}
              onChange={(event) => setDateFrom(event.target.value)}
              style={{ paddingLeft: '2.5rem' }}
            />
          </div>
        </div>

        <div>
          <label
            style={{
              display: 'block',
              marginBottom: 6,
              color: 'var(--brand-navy)',
              fontSize: '0.82rem',
              fontWeight: 700,
            }}
          >
            Au
          </label>
          <div style={{ position: 'relative' }}>
            <CalendarDays
              size={16}
              style={{
                position: 'absolute',
                left: 14,
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--brand-muted)',
                pointerEvents: 'none',
              }}
            />
            <input
              className="input"
              type="date"
              value={dateTo}
              onChange={(event) => setDateTo(event.target.value)}
              style={{ paddingLeft: '2.5rem' }}
            />
          </div>
        </div>

        <button type="button" className="btn btn-primary" onClick={handleDownload} disabled={isPending}>
          {isPending ? <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> : <Download size={16} />}
          {isPending ? 'Préparation du PDF...' : 'Télécharger mon rapport PDF'}
        </button>
      </div>

      {error ? (
        <div
          style={{
            marginTop: '0.9rem',
            padding: '0.85rem 1rem',
            borderRadius: 14,
            border: '1px solid rgba(192, 57, 43, 0.18)',
            background: 'rgba(239, 68, 68, 0.08)',
            color: '#991b1b',
            fontSize: '0.88rem',
          }}
        >
          {error}
        </div>
      ) : null}
    </div>
  )
}
