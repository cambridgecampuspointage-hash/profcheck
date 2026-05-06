'use client'

import { useMemo } from 'react'
import { CalendarRange, CheckCircle2, Clock3, UserX } from 'lucide-react'
import { computeWeekKpis } from '@/lib/kpis/computeAdminKpis'
import type { PlannedSession } from '@/types/planning'
import { KpiCard } from './KpiCard'
import { TeacherRankingTable } from './TeacherRankingTable'

export function WeekPanel({
  plannedSessions,
  weekStart,
}: {
  plannedSessions: PlannedSession[]
  weekStart: Date
}) {
  const weekKpis = useMemo(() => computeWeekKpis(plannedSessions, weekStart), [plannedSessions, weekStart])
  const maxValue = useMemo(
    () => Math.max(...weekKpis.byDay.map((day) => Math.max(day.completed, day.absent)), 1),
    [weekKpis.byDay],
  )

  return (
    <div style={{ display: 'grid', gap: '1.2rem' }}>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '1rem',
        }}
      >
        <KpiCard label="Planifiées" value={weekKpis.totalPlanned} icon={<CalendarRange size={18} />} />
        <KpiCard label="Complétées" value={weekKpis.totalCompleted} status="good" icon={<CheckCircle2 size={18} />} />
        <KpiCard
          label="Absences"
          value={weekKpis.totalAbsent}
          status={weekKpis.totalAbsent > 0 ? 'warning' : 'good'}
          icon={<UserX size={18} />}
        />
        <KpiCard
          label="Taux de réalisation"
          value={weekKpis.completionRate}
          unit="%"
          status={weekKpis.completionRate < 75 ? 'critical' : weekKpis.completionRate < 85 ? 'warning' : 'good'}
          icon={<Clock3 size={18} />}
        />
      </div>

      <section
        style={{
          background: '#FFFFFF',
          border: '1px solid #E8E2D5',
          borderRadius: 24,
          padding: '1.15rem',
        }}
      >
        <div style={{ color: '#1B2D5B', fontWeight: 800, marginBottom: '1rem' }}>Rythme de la semaine</div>

        {weekKpis.byDay.length === 0 ? (
          <div style={{ color: '#8B7D6B' }}>Aucune séance planifiée cette semaine.</div>
        ) : (
          <svg width="100%" height="220" viewBox="0 0 640 220" role="img" aria-label="Graphique hebdomadaire">
            {weekKpis.byDay.map((day, index) => {
              const x = 50 + (index * 96)
              const completedHeight = (day.completed / maxValue) * 120
              const absentHeight = (day.absent / maxValue) * 120
              return (
                <g key={day.date}>
                  <rect x={x} y={150 - completedHeight} width={26} height={completedHeight} rx={8} fill="#1B2D5B" />
                  <rect x={x + 32} y={150 - absentHeight} width={26} height={absentHeight} rx={8} fill="#E53E3E" />
                  <text x={x + 13} y={170} textAnchor="middle" fill="#8B7D6B" fontSize="12">{day.label}</text>
                </g>
              )
            })}
          </svg>
        )}
      </section>

      <section
        style={{
          background: '#FFFFFF',
          border: '1px solid #E8E2D5',
          borderRadius: 24,
          padding: '1.15rem',
        }}
      >
        <div style={{ color: '#1B2D5B', fontWeight: 800, marginBottom: '1rem' }}>Classement des profs</div>
        <TeacherRankingTable data={weekKpis.byTeacher} mode="week" />
      </section>
    </div>
  )
}
