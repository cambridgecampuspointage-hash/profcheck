'use client'

import { useEffect, useState } from 'react'
import type { RoomKpi } from '@/types/kpis'

export function RoomOccupancyBar({ rooms }: { rooms: RoomKpi[] }) {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    const timer = window.setTimeout(() => setMounted(true), 60)
    return () => window.clearTimeout(timer)
  }, [])

  if (rooms.length === 0) {
    return (
      <div style={{ color: '#8B7D6B', fontSize: '0.94rem' }}>
        Aucune occupation de salle sur cette période.
      </div>
    )
  }

  return (
    <div style={{ display: 'grid', gap: '0.95rem' }}>
      {rooms.map((room) => {
        const color = room.occupancyRate > 85 ? '#E53E3E' : room.occupancyRate < 50 ? '#B8ADA0' : '#1B2D5B'
        const note = room.occupancyRate > 85 ? 'Salle saturée' : room.occupancyRate < 50 ? 'Sous-utilisée' : 'Rythme normal'

        return (
          <div key={room.room_id}>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'minmax(120px, 180px) 1fr auto auto',
                gap: '0.75rem',
                alignItems: 'center',
              }}
              title={`${room.room_name} — ${room.totalSessions} séances — ${room.totalHours}h ce mois — ${room.occupancyRate}% d'occupation`}
            >
              <div style={{ color: '#1B2D5B', fontWeight: 700 }}>{room.room_name}</div>
              <div
                style={{
                  height: 12,
                  background: '#F1ECE3',
                  borderRadius: 999,
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    width: `${mounted ? Math.min(room.occupancyRate, 100) : 0}%`,
                    height: '100%',
                    background: color,
                    borderRadius: 999,
                    transition: 'width 0.6s ease',
                  }}
                />
              </div>
              <div style={{ color, fontWeight: 700, minWidth: 54, textAlign: 'right' }}>{room.occupancyRate}%</div>
              <div style={{ color: '#8B7D6B', fontSize: '0.84rem', minWidth: 120, textAlign: 'right' }}>
                {room.totalSessions} séances · {note}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
