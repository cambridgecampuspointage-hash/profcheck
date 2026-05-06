'use client'

import { useMemo, useState } from 'react'
import type { LateTeacher } from '@/types/kpis'

type AlertItem = {
  key: string
  label: string
  targetId: string
}

function todayStorageKey() {
  return `dismissed_alerts_${new Date().toLocaleDateString('en-CA', { timeZone: 'Africa/Casablanca' })}`
}

export function AlertsBanner({
  lateTeachers,
  sessionsOutOfPlanning,
  sessionsAbsent,
}: {
  lateTeachers: LateTeacher[]
  sessionsOutOfPlanning: number
  sessionsAbsent: number
}) {
  const [dismissed, setDismissed] = useState(() => {
    if (typeof window === 'undefined') return false
    return localStorage.getItem(todayStorageKey()) === 'true'
  })
  const alerts = useMemo(() => {
    const items: AlertItem[] = []

    if (lateTeachers.length > 0) {
      items.push({
        key: 'late',
        label: `${lateTeachers.length} prof${lateTeachers.length > 1 ? 's' : ''} n'ont pas pointé et sont en retard`,
        targetId: 'today-late',
      })
    }

    if (sessionsOutOfPlanning > 0) {
      items.push({
        key: 'out',
        label: `${sessionsOutOfPlanning} session${sessionsOutOfPlanning > 1 ? 's' : ''} sans créneau planifié détectée${sessionsOutOfPlanning > 1 ? 's' : ''}`,
        targetId: 'today-out-of-planning',
      })
    }

    if (sessionsAbsent > 0) {
      items.push({
        key: 'absent',
        label: `${sessionsAbsent} absence${sessionsAbsent > 1 ? 's' : ''} enregistrée${sessionsAbsent > 1 ? 's' : ''} ce matin`,
        targetId: 'today-absent',
      })
    }

    return items
  }, [lateTeachers.length, sessionsAbsent, sessionsOutOfPlanning])

  if (alerts.length === 0 || dismissed) {
    return null
  }

  return (
    <div
      style={{
        background: '#FEF2F2',
        border: '1px solid #F5C2C7',
        borderRadius: 20,
        padding: '1rem 1.1rem',
        display: 'flex',
        justifyContent: 'space-between',
        gap: '1rem',
        alignItems: 'flex-start',
        flexWrap: 'wrap',
      }}
    >
      <div style={{ display: 'flex', gap: '0.8rem', alignItems: 'flex-start', flex: 1, minWidth: 240 }}>
        <div style={{ fontSize: '1.2rem', lineHeight: 1 }}>⚠</div>
        <div style={{ display: 'grid', gap: '0.45rem' }}>
          {alerts.map((alert) => (
            <button
              key={alert.key}
              type="button"
              onClick={() => {
                document.getElementById(alert.targetId)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
              }}
              style={{
                background: 'transparent',
                border: 'none',
                padding: 0,
                margin: 0,
                textAlign: 'left',
                color: '#9B1C1C',
                cursor: 'pointer',
                fontSize: '0.92rem',
                fontWeight: 600,
              }}
            >
              {alert.label}
            </button>
          ))}
        </div>
      </div>

      <button
        type="button"
        onClick={() => {
          localStorage.setItem(todayStorageKey(), 'true')
          setDismissed(true)
        }}
        style={{
          border: '1px solid #F1AEB5',
          background: '#FFFFFF',
          color: '#9B1C1C',
          borderRadius: 999,
          padding: '0.6rem 0.95rem',
          fontWeight: 700,
          cursor: 'pointer',
        }}
      >
        Tout ignorer
      </button>
    </div>
  )
}
