'use client'

import type { ReactNode } from 'react'
import { useMemo, useState } from 'react'
import { MiniSparkline } from './MiniSparkline'
import type { TeacherMonthKpi, TeacherWeekKpi } from '@/types/kpis'

type SortKey =
  | 'teacher_name'
  | 'planned'
  | 'completed'
  | 'absent'
  | 'punctualityRate'
  | 'plannedHours'
  | 'completedHours'
  | 'oneToOneCount'
  | 'estimatedPayMAD'
  | 'completionRate'

function isMonthRow(row: TeacherWeekKpi | TeacherMonthKpi): row is TeacherMonthKpi {
  return 'plannedHours' in row
}

function punctualityColor(value: number) {
  if (value >= 90) return '#0F9D58'
  if (value >= 70) return '#D97706'
  return '#E53E3E'
}

export function TeacherRankingTable({
  data,
  mode,
}: {
  data: TeacherWeekKpi[] | TeacherMonthKpi[]
  mode: 'week' | 'month'
}) {
  const [sortKey, setSortKey] = useState<SortKey>('completionRate')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc')

  const sortedData = useMemo(() => {
    const rows = [...data]
    rows.sort((left, right) => {
      const leftValue = left[sortKey as keyof typeof left]
      const rightValue = right[sortKey as keyof typeof right]

      if (typeof leftValue === 'string' && typeof rightValue === 'string') {
        return sortDirection === 'asc'
          ? leftValue.localeCompare(rightValue)
          : rightValue.localeCompare(leftValue)
      }

      const leftNumber = typeof leftValue === 'number' ? leftValue : 0
      const rightNumber = typeof rightValue === 'number' ? rightValue : 0
      return sortDirection === 'asc' ? leftNumber - rightNumber : rightNumber - leftNumber
    })
    return rows
  }, [data, sortDirection, sortKey])

  const handleSort = (key: SortKey) => {
    setSortKey((current) => {
      if (current === key) {
        setSortDirection((direction) => (direction === 'desc' ? 'asc' : 'desc'))
        return current
      }

      setSortDirection('desc')
      return key
    })
  }

  if (data.length === 0) {
    return (
      <div style={{ color: '#8B7D6B', fontSize: '0.94rem' }}>
        Aucune donnée professeur disponible pour cette période.
      </div>
    )
  }

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 860 }}>
        <thead>
          <tr style={{ borderBottom: '1px solid #E8E2D5' }}>
            {mode === 'week' ? (
              <>
                <HeaderCell label="Prof" onClick={() => handleSort('teacher_name')} />
                <HeaderCell label="Planifiées" onClick={() => handleSort('planned')} align="right" />
                <HeaderCell label="Complétées" onClick={() => handleSort('completed')} align="right" />
                <HeaderCell label="Absences" onClick={() => handleSort('absent')} align="right" />
                <HeaderCell label="Ponctualité" onClick={() => handleSort('punctualityRate')} align="right" />
                <HeaderCell label="Tendance" />
              </>
            ) : (
              <>
                <HeaderCell label="Prof" onClick={() => handleSort('teacher_name')} />
                <HeaderCell label="Heures" onClick={() => handleSort('plannedHours')} align="right" />
                <HeaderCell label="Complétées" onClick={() => handleSort('completedHours')} align="right" />
                <HeaderCell label="Absences" onClick={() => handleSort('absent')} align="right" />
                <HeaderCell label="One-to-one" onClick={() => handleSort('oneToOneCount')} align="right" />
                <HeaderCell label="Paie MAD" onClick={() => handleSort('estimatedPayMAD')} align="right" />
                <HeaderCell label="Ponctualité" onClick={() => handleSort('punctualityRate')} align="right" />
                <HeaderCell label="Tendance" />
              </>
            )}
          </tr>
        </thead>
        <tbody>
          {sortedData.map((row) => {
            const monthRow = isMonthRow(row)
            const rowAbsences = monthRow ? row.absenceCount : row.absent
            const highlight = row.punctualityRate === 100
            const weekRow = monthRow ? null : row

            return (
              <tr
                key={row.teacher_id}
                style={{
                  borderBottom: '1px solid #F1ECE3',
                  background: highlight ? 'rgba(201, 168, 76, 0.12)' : 'transparent',
                }}
              >
                <td style={{ padding: '0.9rem 0.75rem', color: '#1B2D5B', fontWeight: 700 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span>{row.teacher_name}</span>
                    {rowAbsences > 2 ? (
                      <span style={{ color: '#E53E3E', fontSize: '0.82rem', fontWeight: 800 }}>⚠</span>
                    ) : null}
                  </div>
                </td>

                {mode === 'week' ? (
                  <>
                    <Cell align="right">{weekRow?.planned ?? '—'}</Cell>
                    <Cell align="right">{weekRow?.completed ?? '—'}</Cell>
                    <Cell align="right">{weekRow?.absent ?? '—'}</Cell>
                    <Cell align="right" color={punctualityColor(row.punctualityRate)}>
                      {row.punctualityRate}%
                    </Cell>
                    <Cell>
                      <MiniSparkline data={row.byDay} />
                    </Cell>
                  </>
                ) : (
                  <>
                    <Cell align="right">{monthRow ? `${row.plannedHours.toLocaleString('fr-FR')}h` : '—'}</Cell>
                    <Cell align="right">{monthRow ? `${row.completedHours.toLocaleString('fr-FR')}h` : '—'}</Cell>
                    <Cell align="right">{monthRow ? row.absenceCount : '—'}</Cell>
                    <Cell align="right">{monthRow ? row.oneToOneCount : '—'}</Cell>
                    <Cell align="right">{monthRow ? `${row.estimatedPayMAD.toLocaleString('fr-FR')} MAD` : '—'}</Cell>
                    <Cell align="right" color={punctualityColor(row.punctualityRate)}>
                      {row.punctualityRate}%
                    </Cell>
                    <Cell>
                      <MiniSparkline data={row.byDay} />
                    </Cell>
                  </>
                )}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function HeaderCell({
  label,
  onClick,
  align = 'left',
}: {
  label: string
  onClick?: () => void
  align?: 'left' | 'right'
}) {
  return (
    <th
      onClick={onClick}
      style={{
        padding: '0.9rem 0.75rem',
        textAlign: align,
        color: '#8B7D6B',
        fontSize: '0.78rem',
        letterSpacing: '0.06em',
        textTransform: 'uppercase',
        fontWeight: 800,
        cursor: onClick ? 'pointer' : 'default',
        whiteSpace: 'nowrap',
      }}
    >
      {label}
    </th>
  )
}

function Cell({
  children,
  align = 'left',
  color = '#3D4B6D',
}: {
  children: ReactNode
  align?: 'left' | 'right'
  color?: string
}) {
  return (
    <td style={{ padding: '0.9rem 0.75rem', textAlign: align, color, fontWeight: 600 }}>
      {children}
    </td>
  )
}
