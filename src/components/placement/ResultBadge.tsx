'use client'

import type { CSSProperties } from 'react'

type ResultBadgeProps = {
  fullName: string
  badge: string
  estimatedLevel: string
  xp: number
  score: number
  recommendedClass: string
  summary: string
  bestStreak: number
  completedAt?: string
  whatsappHref?: string | null
  onRestart: () => void
}

export function ResultBadge({
  fullName,
  badge,
  estimatedLevel,
  xp,
  score,
  recommendedClass,
  summary,
  bestStreak,
  completedAt,
  whatsappHref,
  onRestart,
}: ResultBadgeProps) {
  const handleDownloadCertificate = async () => {
    const { generatePlacementCertificatePdf } = await import('@/lib/pdf/generatePlacementCertificate')
    const certificateRef = `CCQ-${(completedAt || new Date().toISOString()).slice(0, 10).replace(/-/g, '')}-${fullName
      .replace(/[^A-Za-z0-9]/g, '')
      .slice(0, 6)
      .toUpperCase()}`

    await generatePlacementCertificatePdf({
      fullName,
      badge,
      estimatedLevel,
      recommendedClass,
      score,
      xp,
      completedAt: completedAt || new Date().toISOString(),
      certificateRef,
    })
  }

  return (
    <section style={{ display: 'grid', gap: '1rem' }}>
      <div style={{ display: 'grid', gap: '0.65rem' }}>
        <div style={{ color: 'var(--brand-gold)', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.08em', fontSize: '0.82rem' }}>
          Quest Completed
        </div>
        <h1 style={{ margin: 0, color: 'var(--brand-navy)', fontSize: 'clamp(2rem, 6vw, 3.7rem)', lineHeight: 0.95, fontFamily: 'var(--font-serif-brand)' }}>
          🎉 You are a {badge}!
        </h1>
        <p style={{ margin: 0, color: 'var(--brand-muted)', lineHeight: 1.75, maxWidth: 620 }}>
          {fullName}, {summary}
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '0.85rem' }}>
        {[
          ['Estimated level', estimatedLevel],
          ['Recommended class', recommendedClass],
          ['Quest score', `${score}%`],
          ['XP earned', `${xp} XP`],
          ['Best streak', `${bestStreak}`],
        ].map(([label, value]) => (
          <div key={label} style={statCardStyle}>
            <div style={{ color: 'var(--brand-subtle)', fontSize: '0.82rem', marginBottom: 6 }}>{label}</div>
            <div style={{ color: 'var(--brand-navy)', fontWeight: 800, fontSize: '1.05rem' }}>{value}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: '0.8rem', flexWrap: 'wrap' }}>
        <button type="button" onClick={handleDownloadCertificate} style={primaryLinkButtonStyle}>
          Download Certificate
        </button>
        {whatsappHref ? (
          <a href={whatsappHref} target="_blank" rel="noreferrer" style={primaryLinkStyle}>
            Contact us on WhatsApp
          </a>
        ) : null}
        <button type="button" onClick={onRestart} style={secondaryButtonStyle}>
          Restart the Quest
        </button>
      </div>
    </section>
  )
}

const statCardStyle: CSSProperties = {
  padding: '1rem',
  borderRadius: 22,
  background: 'var(--brand-paper)',
  border: '1px solid var(--brand-border)',
}

const primaryLinkStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  borderRadius: 18,
  padding: '0.95rem 1.15rem',
  background: 'linear-gradient(135deg, var(--brand-navy) 0%, var(--brand-navy-soft) 100%)',
  color: '#fff',
  fontWeight: 800,
  textDecoration: 'none',
}

const primaryLinkButtonStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  borderRadius: 18,
  padding: '0.95rem 1.15rem',
  background: 'linear-gradient(135deg, var(--brand-gold) 0%, #b8922f 100%)',
  color: '#fff',
  fontWeight: 800,
  border: 0,
  cursor: 'pointer',
}

const secondaryButtonStyle: CSSProperties = {
  borderRadius: 18,
  border: '1px solid var(--brand-border)',
  padding: '0.95rem 1.15rem',
  background: 'var(--brand-paper)',
  color: 'var(--brand-navy)',
  fontWeight: 800,
  cursor: 'pointer',
}
