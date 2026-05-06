'use client'

import { useMemo } from 'react'
import { Activity, AlertTriangle, CalendarClock, MapPinned } from 'lucide-react'
import type { AttendanceSession } from '@/lib/types'
import { computeTodayKpis } from '@/lib/kpis/computeAdminKpis'
import type { PlannedSession } from '@/types/planning'
import { StatusBadge } from '@/app/dashboard/planning/components/StatusBadge'
import { KpiCard } from './KpiCard'

function durationLabel(minutes: number) {
  if (minutes === 60) return '1h'
  if (minutes === 90) return '1h30'
  if (minutes === 120) return '2h'
  if (minutes === 180) return '3h'
  return `${minutes} min`
}

export function TodayPanel({
  plannedSessions,
  attendanceSessions,
}: {
  plannedSessions: PlannedSession[]
  attendanceSessions: AttendanceSession[]
}) {
  const kpis = useMemo(
    () => computeTodayKpis(plannedSessions, attendanceSessions),
    [attendanceSessions, plannedSessions],
  )

  const timeline = useMemo(
    () => [...plannedSessions].sort((left, right) => left.start_time.localeCompare(right.start_time)),
    [plannedSessions],
  )

  const linkedIds = new Set(plannedSessions.map((session) => session.linked_session_id).filter(Boolean))
  const outOfPlanning = attendanceSessions.filter((session) => !linkedIds.has(session.id))

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
          label="Sessions en cours"
          value={kpis.sessionsInProgress}
          status="good"
          accentColor="#0F9D58"
          icon={<Activity size={18} />}
        />
        <KpiCard
          label="Absences du jour"
          value={kpis.sessionsAbsent}
          status={kpis.sessionsAbsent > 0 ? 'critical' : 'good'}
          accentColor="#E53E3E"
          icon={<AlertTriangle size={18} />}
        />
        <KpiCard
          label="À venir aujourd’hui"
          value={kpis.sessionsScheduledRemaining}
          accentColor="#1B2D5B"
          icon={<CalendarClock size={18} />}
        />
        <KpiCard
          label="Hors planning"
          value={kpis.sessionsOutOfPlanning}
          status={kpis.sessionsOutOfPlanning > 0 ? 'warning' : 'good'}
          accentColor="#EF9F27"
          icon={<MapPinned size={18} />}
        />
      </div>

      {kpis.activeRooms.length > 0 ? (
        <section
          style={{
            background: '#FFFFFF',
            border: '1px solid #E8E2D5',
            borderRadius: 22,
            padding: '1.1rem',
          }}
        >
          <div style={{ color: '#1B2D5B', fontWeight: 800, marginBottom: '0.75rem' }}>Salles actives</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.6rem' }}>
            {kpis.activeRooms.map((room) => (
              <span
                key={room}
                style={{
                  background: 'rgba(27, 45, 91, 0.08)',
                  color: '#1B2D5B',
                  padding: '0.45rem 0.8rem',
                  borderRadius: 999,
                  fontWeight: 700,
                  fontSize: '0.86rem',
                }}
              >
                {room}
              </span>
            ))}
          </div>
        </section>
      ) : null}

      {kpis.lateTeachers.length > 0 ? (
        <section
          id="today-late"
          style={{
            background: '#FFF7F7',
            border: '1px solid #F3C4C4',
            borderRadius: 22,
            padding: '1.1rem',
          }}
        >
          <div style={{ color: '#9B1C1C', fontWeight: 800, marginBottom: '0.85rem' }}>Profs en retard</div>
          <div style={{ display: 'grid', gap: '0.55rem' }}>
            {kpis.lateTeachers.map((teacher) => (
              <div key={`${teacher.teacher_name}-${teacher.scheduled_time}`} style={{ color: '#9B1C1C', fontWeight: 600 }}>
                ⚠ {teacher.teacher_name} — planifié à {teacher.scheduled_time} — {teacher.minutes_late} min de retard — {teacher.room}
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {outOfPlanning.length > 0 ? (
        <section
          id="today-out-of-planning"
          style={{
            background: '#FFF8ED',
            border: '1px solid #F0D5A8',
            borderRadius: 22,
            padding: '1.1rem',
          }}
        >
          <div style={{ color: '#A25A06', fontWeight: 800, marginBottom: '0.85rem' }}>Sessions hors planning</div>
          <div style={{ display: 'grid', gap: '0.55rem' }}>
            {outOfPlanning.map((session) => (
              <div key={session.id} style={{ color: '#A25A06', fontWeight: 600 }}>
                {session.teacher?.full_name || 'Professeur'} — {session.room?.name || 'Salle non assignée'} —{' '}
                {new Date(session.started_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <section
        style={{
          background: '#FFFFFF',
          border: '1px solid #E8E2D5',
          borderRadius: 24,
          padding: '1.15rem',
        }}
      >
        <div style={{ color: '#1B2D5B', fontWeight: 800, marginBottom: '0.95rem' }}>Timeline du jour</div>

        {timeline.length === 0 ? (
          <div style={{ color: '#8B7D6B', padding: '1rem 0.25rem' }}>
            Aucune séance planifiée aujourd&apos;hui.
          </div>
        ) : (
          <div style={{ display: 'grid', gap: '0.65rem' }}>
            {timeline.map((session) => (
              <div
                key={session.id}
                id={session.status === 'absent' ? 'today-absent' : undefined}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '90px minmax(160px, 1.2fr) minmax(120px, 1fr) 100px 120px auto',
                  gap: '0.8rem',
                  alignItems: 'center',
                  padding: '0.85rem 0.95rem',
                  borderRadius: 18,
                  background: session.status === 'in_progress' ? 'rgba(27, 45, 91, 0.08)' : '#FAF8F3',
                  border: session.status === 'in_progress' ? '1px solid rgba(27, 45, 91, 0.18)' : '1px solid transparent',
                }}
              >
                <div style={{ color: '#1B2D5B', fontWeight: 800 }}>{session.start_time.slice(0, 5)}</div>
                <div style={{ color: '#1B2D5B', fontWeight: 700 }}>{session.teacher?.full_name || 'Professeur'}</div>
                <div style={{ color: '#6E6254', fontWeight: 600 }}>{session.room?.name || '—'}</div>
                <div style={{ color: '#6E6254', fontWeight: 600 }}>{durationLabel(session.duration_minutes)}</div>
                <div style={{ color: '#6E6254', fontWeight: 700 }}>
                  {session.session_type === 'one_to_one' ? 'One-to-one' : 'Groupe'}
                </div>
                <StatusBadge status={session.status} />
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
