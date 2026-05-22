'use client'

import type { CSSProperties } from 'react'

type QuestWelcomeProps = {
  onStart: () => void
}

export function QuestWelcome({ onStart }: QuestWelcomeProps) {
  return (
    <section style={panelStyle}>
      <div style={eyebrowStyle}>Cambridge English Quest</div>
      <h1 style={titleStyle}>Start your English Quest</h1>
      <p style={copyStyle}>
        Answer fun challenges, collect XP, and discover your English level in about 10 to 15 minutes.
      </p>

      <div style={featureGridStyle}>
        {[
          ['5 Missions', 'Short scenes instead of a long exam page.'],
          ['1 Question at a Time', 'Clear focus, big buttons, mobile friendly.'],
          ['Level Badge', 'Get a smart result and a recommended class.'],
        ].map(([title, description]) => (
          <div key={title} style={featureCardStyle}>
            <div style={{ fontWeight: 800, color: '#0f172a', marginBottom: 6 }}>{title}</div>
            <div style={{ color: '#475569', fontSize: '0.94rem', lineHeight: 1.55 }}>{description}</div>
          </div>
        ))}
      </div>

      <button type="button" onClick={onStart} style={ctaStyle}>
        Start the Quest
      </button>
    </section>
  )
}

const panelStyle: CSSProperties = {
  display: 'grid',
  gap: '1.4rem',
}

const eyebrowStyle: CSSProperties = {
  display: 'inline-flex',
  width: 'fit-content',
  alignItems: 'center',
  gap: '0.45rem',
  padding: '0.45rem 0.8rem',
  borderRadius: 999,
  background: 'var(--brand-gold-soft)',
  color: 'var(--brand-navy)',
  fontSize: '0.82rem',
  fontWeight: 800,
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
}

const titleStyle: CSSProperties = {
  margin: 0,
  fontSize: 'clamp(2.2rem, 6vw, 4.2rem)',
  lineHeight: 0.95,
  color: 'var(--brand-navy)',
  fontWeight: 900,
  fontFamily: 'var(--font-serif-brand)',
}

const copyStyle: CSSProperties = {
  margin: 0,
  color: 'var(--brand-muted)',
  fontSize: '1.02rem',
  lineHeight: 1.7,
  maxWidth: 560,
}

const featureGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
  gap: '0.9rem',
}

const featureCardStyle: CSSProperties = {
  padding: '1rem',
  borderRadius: 22,
  background: 'var(--brand-paper)',
  border: '1px solid var(--brand-border)',
}

const ctaStyle: CSSProperties = {
  width: 'fit-content',
  border: 0,
  borderRadius: 18,
  background: 'linear-gradient(135deg, var(--brand-navy) 0%, var(--brand-navy-soft) 100%)',
  color: 'white',
  fontWeight: 800,
  padding: '1rem 1.3rem',
  fontSize: '1rem',
  cursor: 'pointer',
  boxShadow: '0 18px 50px rgba(27, 45, 91, 0.2)',
}
