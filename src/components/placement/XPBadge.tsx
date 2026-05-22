'use client'

type XPBadgeProps = {
  xp: number
  streak: number
  message: string
  tone?: 'success' | 'neutral'
}

export function XPBadge({ xp, streak, message, tone = 'neutral' }: XPBadgeProps) {
  return (
    <div
      style={{
        display: 'grid',
        gap: '0.45rem',
        padding: '1rem 1.1rem',
        borderRadius: 22,
        background: tone === 'success' ? '#ecfdf3' : 'var(--brand-paper)',
        border: tone === 'success' ? '1px solid #bbf7d0' : '1px solid var(--brand-border)',
      }}
    >
      <div style={{ display: 'flex', gap: '0.9rem', flexWrap: 'wrap' }}>
        <strong style={{ color: 'var(--brand-navy)' }}>XP {xp}</strong>
        <span style={{ color: 'var(--brand-gold)' }}>🔥 Streak {streak}</span>
      </div>
      <div style={{ color: 'var(--brand-muted)', lineHeight: 1.55 }}>{message}</div>
    </div>
  )
}
