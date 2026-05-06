'use client'

import type { SessionStatus } from '@/types/planning'

const STATUS_STYLES: Record<SessionStatus, { label: string; background: string; color: string; dot: string }> = {
  scheduled: { label: 'Prévu', background: '#f3f4f6', color: '#4b5563', dot: '#9ca3af' },
  in_progress: { label: 'En cours', background: '#fef3c7', color: '#b45309', dot: '#f59e0b' },
  completed: { label: 'Complété', background: '#dcfce7', color: '#166534', dot: '#22c55e' },
  absent: { label: 'Absent', background: '#fee2e2', color: '#b91c1c', dot: '#ef4444' },
  cancelled: { label: 'Annulé', background: '#475569', color: '#ffffff', dot: '#cbd5e1' },
}

export function StatusBadge({ status, size = 'md' }: { status: SessionStatus; size?: 'sm' | 'md' }) {
  const style = STATUS_STYLES[status]
  const fontSize = size === 'sm' ? 11 : 13
  const padding = size === 'sm' ? '0.25rem 0.55rem' : '0.32rem 0.7rem'

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.4rem',
        padding,
        borderRadius: 999,
        background: style.background,
        color: style.color,
        fontSize,
        fontWeight: 700,
        whiteSpace: 'nowrap',
      }}
    >
      <span
        style={{
          width: size === 'sm' ? 6 : 8,
          height: size === 'sm' ? 6 : 8,
          borderRadius: '50%',
          background: style.dot,
          display: 'inline-block',
        }}
      />
      {style.label}
    </span>
  )
}
