'use client'

import type { CSSProperties } from 'react'
import { minutesToLabel } from '@/lib/reception/computeReceptionKpis'
import type { ReceptionMonthSummaryRow } from '@/types/reception'

export function MonthSummaryTable({
  rows,
}: {
  rows: ReceptionMonthSummaryRow[]
}) {
  if (rows.length === 0) {
    return <div style={{ color: '#8B7D6B' }}>Aucune donnée réception pour ce mois.</div>
  }

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 920 }}>
        <thead>
          <tr style={{ borderBottom: '1px solid #E8E2D5' }}>
            {['Réceptionniste', 'Jours', 'Retards', 'Absences', 'Pauses longues', 'Départs anticipés', 'Départs manquants', 'Présence totale', 'Moyenne / jour'].map((header) => (
              <th key={header} style={headerStyle}>{header}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.user_id} style={{ borderBottom: '1px solid #F1ECE3' }}>
              <td style={cellStyle}>{row.full_name}</td>
              <td style={cellStyle}>{row.workedDays}</td>
              <td style={cellStyle}>{row.lateCount}</td>
              <td style={{ ...cellStyle, color: row.absenceCount > 0 ? '#E53E3E' : '#1B2D5B' }}>{row.absenceCount}</td>
              <td style={cellStyle}>{row.longBreakCount}</td>
              <td style={cellStyle}>{row.earlyLeaveCount}</td>
              <td style={cellStyle}>{row.missingClockOutCount}</td>
              <td style={cellStyle}>{minutesToLabel(row.totalPresentMinutes)}</td>
              <td style={cellStyle}>{minutesToLabel(row.averagePresentMinutes)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

const headerStyle: CSSProperties = {
  textAlign: 'left',
  padding: '0.85rem 0.75rem',
  color: '#8B7D6B',
  fontSize: '0.78rem',
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
}

const cellStyle: CSSProperties = {
  padding: '0.9rem 0.75rem',
  color: '#1B2D5B',
  fontWeight: 600,
}
