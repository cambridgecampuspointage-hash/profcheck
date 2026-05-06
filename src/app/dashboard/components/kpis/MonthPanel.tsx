'use client'

import { useMemo } from 'react'
import { BarChart3, Coins, GraduationCap, Timer, UserRound } from 'lucide-react'
import type { AttendanceSession, Room, Teacher } from '@/lib/types'
import { computeMonthKpis } from '@/lib/kpis/computeAdminKpis'
import { downloadCsv, generateCsv } from '@/lib/utils'
import type { PlannedSession } from '@/types/planning'
import { KpiCard } from './KpiCard'
import { RoomOccupancyBar } from './RoomOccupancyBar'
import { TeacherRankingTable } from './TeacherRankingTable'

function trendLabel(value: number) {
  const sign = value > 0 ? '+' : ''
  return `${sign}${value.toLocaleString('fr-FR')}%`
}

function progressBar(label: string, value: number, color: string) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr auto', gap: '0.85rem', alignItems: 'center' }}>
      <div style={{ color: '#1B2D5B', fontWeight: 700 }}>{label}</div>
      <div style={{ height: 14, background: '#F1ECE3', borderRadius: 999, overflow: 'hidden' }}>
        <div
          style={{
            width: `${Math.min(value, 100)}%`,
            height: '100%',
            borderRadius: 999,
            background: color,
          }}
        />
      </div>
      <div style={{ color: '#1B2D5B', fontWeight: 800 }}>{value}%</div>
    </div>
  )
}

export function MonthPanel({
  plannedSessions,
  attendanceSessions,
  previousPlannedSessions,
  previousAttendanceSessions,
  teachers,
  rooms,
  month,
  year,
}: {
  plannedSessions: PlannedSession[]
  attendanceSessions: AttendanceSession[]
  previousPlannedSessions: PlannedSession[]
  previousAttendanceSessions: AttendanceSession[]
  teachers: Teacher[]
  rooms: Room[]
  month: number
  year: number
}) {
  const monthKpis = useMemo(
    () => computeMonthKpis(
      plannedSessions,
      attendanceSessions,
      teachers,
      rooms,
      month,
      year,
      {
        plannedSessions: previousPlannedSessions,
        attendanceSessions: previousAttendanceSessions,
      },
    ),
    [attendanceSessions, month, plannedSessions, previousAttendanceSessions, previousPlannedSessions, rooms, teachers, year],
  )

  const exportCsv = () => {
    const headers = ['Professeur', 'Heures complétées', 'Taux horaire', 'Paie estimée']
    const rows = monthKpis.byTeacher.map((teacher) => [
      teacher.teacher_name,
      teacher.completedHours.toLocaleString('fr-FR'),
      teacher.hourlyRate.toLocaleString('fr-FR'),
      teacher.estimatedPayMAD.toLocaleString('fr-FR'),
    ])

    downloadCsv(generateCsv(headers, rows, ';'), `paie-estimee-${year}-${String(month + 1).padStart(2, '0')}.csv`)
  }

  return (
    <div style={{ display: 'grid', gap: '1.2rem' }}>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '1rem',
        }}
      >
        <KpiCard
          label="Heures planifiées"
          value={monthKpis.totalPlannedHours}
          unit="heures"
          icon={<Timer size={18} />}
          trend={monthKpis.vsLastMonth.hoursChange >= 0 ? 'up' : 'down'}
          trendValue={trendLabel(monthKpis.vsLastMonth.hoursChange)}
        />
        <KpiCard
          label="Heures complétées"
          value={monthKpis.totalCompletedHours}
          unit="heures"
          icon={<BarChart3 size={18} />}
          trend={monthKpis.vsLastMonth.sessionsChange >= 0 ? 'up' : 'down'}
          trendValue={trendLabel(monthKpis.vsLastMonth.sessionsChange)}
          status={monthKpis.completionRate < 75 ? 'critical' : monthKpis.completionRate < 85 ? 'warning' : 'good'}
        />
        <KpiCard
          label="Taux réalisation"
          value={monthKpis.completionRate}
          unit="%"
          icon={<GraduationCap size={18} />}
          trend={monthKpis.vsLastMonth.absenceChange <= 0 ? 'up' : 'down'}
          trendValue={trendLabel(-monthKpis.vsLastMonth.absenceChange)}
          status={monthKpis.completionRate < 75 ? 'critical' : monthKpis.completionRate < 85 ? 'warning' : 'good'}
        />
        <KpiCard
          label="Masse salariale"
          value={monthKpis.totalEstimatedPayroll.toLocaleString('fr-FR')}
          unit="MAD"
          icon={<Coins size={18} />}
          trend={monthKpis.vsLastMonth.payrollChange >= 0 ? 'up' : 'down'}
          trendValue={trendLabel(monthKpis.vsLastMonth.payrollChange)}
        />
        <KpiCard
          label="% One-to-one"
          value={monthKpis.oneToOnePercent}
          unit="%"
          icon={<UserRound size={18} />}
          trend={monthKpis.vsLastMonth.oneToOneChange >= 0 ? 'up' : 'down'}
          trendValue={trendLabel(monthKpis.vsLastMonth.oneToOneChange)}
        />
      </div>

      <section
        style={{
          background: '#FFFFFF',
          border: '1px solid #E8E2D5',
          borderRadius: 24,
          padding: '1.15rem',
          display: 'grid',
          gap: '1rem',
        }}
      >
        <div style={{ color: '#1B2D5B', fontWeight: 800 }}>Répartition des sessions</div>
        {progressBar('Groupe', monthKpis.groupPercent, '#1B2D5B')}
        {progressBar('One-to-one', monthKpis.oneToOnePercent, '#C9A84C')}
      </section>

      <section
        style={{
          background: '#FFFFFF',
          border: '1px solid #E8E2D5',
          borderRadius: 24,
          padding: '1.15rem',
        }}
      >
        <div style={{ color: '#1B2D5B', fontWeight: 800, marginBottom: '1rem' }}>Professeurs du mois</div>
        <TeacherRankingTable data={monthKpis.byTeacher} mode="month" />
      </section>

      <section
        style={{
          background: '#FFFFFF',
          border: '1px solid #E8E2D5',
          borderRadius: 24,
          padding: '1.15rem',
        }}
      >
        <div style={{ color: '#1B2D5B', fontWeight: 800, marginBottom: '1rem' }}>Occupation des salles</div>
        <RoomOccupancyBar rooms={monthKpis.byRoom} />
      </section>

      <section
        style={{
          background: '#1B2D5B',
          color: '#FFFFFF',
          borderRadius: 24,
          padding: '1.2rem',
          border: '1px solid rgba(201, 168, 76, 0.22)',
        }}
      >
        <div style={{ color: '#FAF8F3', fontWeight: 800, marginBottom: '1rem' }}>Paie estimée</div>

        {monthKpis.byTeacher.length === 0 ? (
          <div style={{ color: 'rgba(250, 248, 243, 0.78)' }}>Aucune paie estimée pour ce mois.</div>
        ) : (
          <div style={{ display: 'grid', gap: '0.65rem' }}>
            {monthKpis.byTeacher.map((teacher) => (
              <div
                key={teacher.teacher_id}
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'minmax(150px, 1fr) auto auto auto',
                  gap: '0.8rem',
                  alignItems: 'center',
                  color: '#FAF8F3',
                }}
              >
                <div style={{ fontWeight: 700 }}>{teacher.teacher_name}</div>
                <div>{teacher.completedHours.toLocaleString('fr-FR')}h</div>
                <div>{teacher.hourlyRate.toLocaleString('fr-FR')} MAD/h</div>
                <div style={{ textAlign: 'right', fontWeight: 800 }}>
                  {teacher.estimatedPayMAD.toLocaleString('fr-FR')} MAD
                </div>
              </div>
            ))}
            <div style={{ borderTop: '1px solid rgba(255,255,255,0.15)', marginTop: '0.4rem', paddingTop: '0.75rem', display: 'flex', justifyContent: 'space-between', fontWeight: 800 }}>
              <span>TOTAL ESTIMÉ</span>
              <span>{monthKpis.totalEstimatedPayroll.toLocaleString('fr-FR')} MAD</span>
            </div>
          </div>
        )}

        <button
          type="button"
          onClick={exportCsv}
          style={{
            marginTop: '1rem',
            border: '1px solid rgba(255,255,255,0.22)',
            background: '#C9A84C',
            color: '#1B2D5B',
            borderRadius: 14,
            padding: '0.8rem 1rem',
            fontWeight: 800,
            cursor: 'pointer',
          }}
        >
          Exporter en CSV
        </button>
      </section>
    </div>
  )
}
