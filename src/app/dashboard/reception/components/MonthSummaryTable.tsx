'use client'

import { useState } from 'react'
import { Fragment } from 'react'
import type { CSSProperties } from 'react'
import { minutesToLabel } from '@/lib/reception/computeReceptionKpis'
import type { ReceptionMonthSummaryDetail, ReceptionMonthSummaryRow } from '@/types/reception'

export function MonthSummaryTable({
  rows,
}: {
  rows: ReceptionMonthSummaryRow[]
}) {
  const [expandedUserId, setExpandedUserId] = useState<string | null>(null)

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
          {rows.map((row) => {
            const isExpanded = expandedUserId === row.user_id

            return (
              <Fragment key={row.user_id}>
                <tr key={row.user_id} style={{ borderBottom: isExpanded ? 'none' : '1px solid #F1ECE3' }}>
                  <td style={cellStyle}>
                    <button
                      type="button"
                      onClick={() => setExpandedUserId(isExpanded ? null : row.user_id)}
                      style={nameButtonStyle}
                    >
                      {row.full_name}
                    </button>
                  </td>
                  <td style={cellStyle}>{row.workedDays}</td>
                  <td style={cellStyle}>
                    <MetricButton
                      value={row.lateCount}
                      active={isExpanded && row.lateDetails.length > 0}
                      onClick={() => setExpandedUserId(isExpanded ? null : row.user_id)}
                    />
                  </td>
                  <td style={{ ...cellStyle, color: row.absenceCount > 0 ? '#E53E3E' : '#1B2D5B' }}>
                    <MetricButton
                      value={row.absenceCount}
                      active={isExpanded && row.absenceDetails.length > 0}
                      onClick={() => setExpandedUserId(isExpanded ? null : row.user_id)}
                      tone={row.absenceCount > 0 ? 'danger' : 'default'}
                    />
                  </td>
                  <td style={cellStyle}>
                    <MetricButton
                      value={row.longBreakCount}
                      active={isExpanded && row.longBreakDetails.length > 0}
                      onClick={() => setExpandedUserId(isExpanded ? null : row.user_id)}
                    />
                  </td>
                  <td style={cellStyle}>
                    <MetricButton
                      value={row.earlyLeaveCount}
                      active={isExpanded && row.earlyLeaveDetails.length > 0}
                      onClick={() => setExpandedUserId(isExpanded ? null : row.user_id)}
                    />
                  </td>
                  <td style={cellStyle}>
                    <MetricButton
                      value={row.missingClockOutCount}
                      active={isExpanded && row.missingClockOutDetails.length > 0}
                      onClick={() => setExpandedUserId(isExpanded ? null : row.user_id)}
                    />
                  </td>
                  <td style={cellStyle}>{minutesToLabel(row.totalPresentMinutes)}</td>
                  <td style={cellStyle}>{minutesToLabel(row.averagePresentMinutes)}</td>
                </tr>
                {isExpanded ? (
                  <tr style={{ borderBottom: '1px solid #F1ECE3' }}>
                    <td colSpan={9} style={detailCellStyle}>
                      <div style={detailGridStyle}>
                        <DetailBlock label="Retards" items={row.lateDetails} emptyLabel="Aucun retard" />
                        <DetailBlock label="Absences" items={row.absenceDetails} emptyLabel="Aucune absence" />
                        <DetailBlock label="Pauses longues" items={row.longBreakDetails} emptyLabel="Aucune pause longue" />
                        <DetailBlock label="Départs anticipés" items={row.earlyLeaveDetails} emptyLabel="Aucun départ anticipé" />
                        <DetailBlock label="Départs manquants" items={row.missingClockOutDetails} emptyLabel="Aucun départ manquant" />
                      </div>
                    </td>
                  </tr>
                ) : null}
              </Fragment>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function MetricButton({
  value,
  active,
  onClick,
  tone = 'default',
}: {
  value: number
  active: boolean
  onClick: () => void
  tone?: 'default' | 'danger'
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        ...metricButtonStyle,
        color: tone === 'danger' ? '#E53E3E' : '#1B2D5B',
        background: active ? '#EEF3FF' : 'transparent',
        borderColor: active ? '#C9D8FF' : 'transparent',
      }}
    >
      {value}
    </button>
  )
}

function DetailBlock({
  label,
  items,
  emptyLabel,
}: {
  label: string
  items: ReceptionMonthSummaryDetail[]
  emptyLabel: string
}) {
  return (
    <div style={detailBlockStyle}>
      <div style={detailTitleStyle}>{label}</div>
      {items.length === 0 ? (
        <div style={emptyDetailStyle}>{emptyLabel}</div>
      ) : (
        <div style={{ display: 'grid', gap: '0.45rem' }}>
          {items.map((item) => (
            <div key={`${label}-${item.date}-${item.label}`} style={detailItemStyle}>
              <span style={detailDateStyle}>{formatDate(item.date)}</span>
              <span>{item.label}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function formatDate(value: string) {
  const [year, month, day] = value.split('-')
  if (!year || !month || !day) return value
  return `${day}/${month}/${year}`
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

const detailCellStyle: CSSProperties = {
  padding: '0 0.75rem 1rem',
}

const nameButtonStyle: CSSProperties = {
  border: 'none',
  background: 'transparent',
  color: '#1B2D5B',
  fontWeight: 800,
  fontSize: 'inherit',
  padding: 0,
  cursor: 'pointer',
  textAlign: 'left',
}

const metricButtonStyle: CSSProperties = {
  border: '1px solid transparent',
  borderRadius: 10,
  padding: '0.2rem 0.4rem',
  fontWeight: 800,
  fontSize: 'inherit',
  cursor: 'pointer',
}

const detailGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
  gap: '0.75rem',
  background: '#FAF8F3',
  border: '1px solid #F1ECE3',
  borderRadius: 18,
  padding: '0.9rem',
}

const detailBlockStyle: CSSProperties = {
  display: 'grid',
  gap: '0.5rem',
}

const detailTitleStyle: CSSProperties = {
  color: '#8B7D6B',
  fontSize: '0.78rem',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  fontWeight: 800,
}

const detailItemStyle: CSSProperties = {
  display: 'grid',
  gap: '0.12rem',
  color: '#1B2D5B',
  fontWeight: 600,
}

const detailDateStyle: CSSProperties = {
  color: '#8B7D6B',
  fontSize: '0.8rem',
  fontWeight: 700,
}

const emptyDetailStyle: CSSProperties = {
  color: '#8B7D6B',
  fontSize: '0.9rem',
}
