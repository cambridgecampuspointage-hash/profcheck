'use client'

import type { CSSProperties } from 'react'
import { computeDayAttendanceKpis } from '@/lib/reception/computeReceptionKpis'
import type { StaffAttendance, StaffSchedule } from '@/types/reception'

const toneColors: Record<ReturnType<typeof computeDayAttendanceKpis>['statusTone'], string> = {
  neutral: '#1B2D5B',
  warning: '#C77E12',
  danger: '#E53E3E',
  success: '#0F6E56',
}

export function DayAttendanceCard({
  title,
  schedule,
  attendance,
}: {
  title: string
  schedule: StaffSchedule | null
  attendance: StaffAttendance | null
}) {
  const kpis = computeDayAttendanceKpis(schedule, attendance)
  const tone = toneColors[kpis.statusTone]

  return (
    <div style={cardStyle}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'flex-start', marginBottom: '1rem' }}>
        <div>
          <div style={{ color: '#1B2D5B', fontWeight: 800, fontSize: '1.05rem' }}>{title}</div>
          <div style={{ color: tone, fontWeight: 700, marginTop: '0.3rem' }}>{kpis.statusLabel}</div>
        </div>
        <div style={{
          background: `${tone}14`,
          color: tone,
          borderRadius: 999,
          padding: '0.45rem 0.8rem',
          fontWeight: 800,
          fontSize: '0.82rem',
        }}>
          {kpis.totalPresentLabel}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.8rem' }}>
        <InfoBlock label="Horaire prévu" value={kpis.expectedRange} />
        <InfoBlock label="Présence réelle" value={kpis.actualRange} />
        <InfoBlock label="Pause" value={kpis.breakLabel} />
        <InfoBlock label="Retard / Départ" value={`${kpis.lateMinutes} min / ${kpis.earlyLeaveMinutes} min`} />
      </div>

      {kpis.anomalies.length > 0 ? (
        <div style={{ display: 'grid', gap: '0.6rem', marginTop: '1rem' }}>
          {kpis.anomalies.map((anomaly) => (
            <div
              key={`${anomaly.type}-${anomaly.message}`}
              style={{
                border: `1px solid ${anomaly.severity === 'critical' ? 'rgba(229,62,62,0.2)' : 'rgba(201,168,76,0.28)'}`,
                background: anomaly.severity === 'critical' ? 'rgba(229,62,62,0.08)' : 'rgba(201,168,76,0.12)',
                color: anomaly.severity === 'critical' ? '#E53E3E' : '#8A5B10',
                borderRadius: 16,
                padding: '0.8rem 0.95rem',
                fontWeight: 700,
              }}
            >
              {anomaly.title} — {anomaly.message}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  )
}

function InfoBlock({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ background: '#FAF8F3', borderRadius: 18, padding: '0.85rem 0.95rem' }}>
      <div style={{ color: '#8B7D6B', fontSize: '0.8rem', fontWeight: 700, marginBottom: '0.25rem' }}>{label}</div>
      <div style={{ color: '#1B2D5B', fontWeight: 700 }}>{value}</div>
    </div>
  )
}

const cardStyle: CSSProperties = {
  background: '#FFFFFF',
  border: '1px solid #E8E2D5',
  borderRadius: 24,
  padding: '1.1rem',
}
