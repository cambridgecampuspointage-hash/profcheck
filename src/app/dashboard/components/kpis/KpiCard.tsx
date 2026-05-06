'use client'

import type { ReactNode } from 'react'
import type { KpiStatus, KpiTrend } from '@/types/kpis'

const STATUS_COLORS: Record<KpiStatus, string> = {
  good: '#C9A84C',
  warning: '#EF9F27',
  critical: '#E53E3E',
}

const TREND_COLORS: Record<KpiTrend, string> = {
  up: '#0F9D58',
  down: '#E53E3E',
  neutral: '#8B7D6B',
}

export function KpiCard({
  label,
  value,
  unit,
  trend,
  trendValue,
  status,
  icon,
  size = 'md',
  accentColor,
}: {
  label: string
  value: string | number
  unit?: string
  trend?: KpiTrend
  trendValue?: string
  status?: KpiStatus
  icon?: ReactNode
  size?: 'sm' | 'md' | 'lg'
  accentColor?: string
}) {
  const padding = size === 'lg' ? '1.3rem' : size === 'sm' ? '1rem' : '1.15rem'
  const valueSize = size === 'lg' ? '2rem' : size === 'sm' ? '1.45rem' : '1.75rem'
  const topColor = accentColor || (status ? STATUS_COLORS[status] : '#1B2D5B')

  return (
    <div
      style={{
        background: '#FFFFFF',
        border: '1px solid #E8E2D5',
        borderRadius: 22,
        padding,
        position: 'relative',
        boxShadow: '0 12px 30px rgba(27, 45, 91, 0.06)',
        transition: 'transform 0.2s ease, box-shadow 0.2s ease',
        minHeight: size === 'lg' ? 180 : 150,
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: '0 auto auto 0',
          width: '100%',
          height: 3,
          borderRadius: '22px 22px 0 0',
          background: topColor,
        }}
      />

      {icon ? (
        <div
          style={{
            width: 42,
            height: 42,
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: `${topColor}16`,
            color: topColor,
            marginBottom: '0.9rem',
          }}
        >
          {icon}
        </div>
      ) : null}

      <div
        style={{
          fontSize: '0.74rem',
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          color: '#8B7D6B',
          fontWeight: 700,
          marginBottom: '0.65rem',
        }}
      >
        {label}
      </div>

      <div
        style={{
          fontSize: valueSize,
          lineHeight: 1.1,
          fontWeight: 800,
          color: '#1B2D5B',
          fontFamily: 'var(--font-serif-brand), Georgia, serif',
        }}
      >
        {value}
      </div>

      {unit ? (
        <div style={{ color: '#8B7D6B', fontSize: '0.84rem', marginTop: '0.35rem' }}>{unit}</div>
      ) : null}

      <div
        style={{
          marginTop: '1rem',
          minHeight: 20,
          display: 'flex',
          justifyContent: 'flex-end',
          alignItems: 'center',
          color: trend ? TREND_COLORS[trend] : '#8B7D6B',
          fontSize: '0.84rem',
          fontWeight: 700,
        }}
      >
        {trend ? (
          <>
            <span style={{ marginRight: 6 }}>
              {trend === 'up' ? '↑' : trend === 'down' ? '↓' : '—'}
            </span>
            {trendValue || 'Stable'}
          </>
        ) : null}
      </div>
    </div>
  )
}
