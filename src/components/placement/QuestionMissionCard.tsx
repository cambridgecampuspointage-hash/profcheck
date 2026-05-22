'use client'

import type { CSSProperties } from 'react'
import type { PlacementQuestionPublic } from '@/lib/types'

type QuestionMissionCardProps = {
  question: PlacementQuestionPublic
  index: number
  totalQuestions: number
  disabled?: boolean
  onSelect: (option: 'A' | 'B' | 'C' | 'D') => void
}

const OPTION_KEYS: Array<'A' | 'B' | 'C' | 'D'> = ['A', 'B', 'C', 'D']

export function QuestionMissionCard({
  question,
  index,
  totalQuestions,
  disabled,
  onSelect,
}: QuestionMissionCardProps) {
  const options = {
    A: question.option_a,
    B: question.option_b,
    C: question.option_c,
    D: question.option_d,
  }

  return (
    <section style={{ display: 'grid', gap: '1rem' }}>
      <div style={{ display: 'grid', gap: '0.75rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flexWrap: 'wrap' }}>
          <span style={missionPillStyle}>{question.mission_icon} Mission {question.mission_order}</span>
          <span style={{ color: 'var(--brand-muted)', fontWeight: 700 }}>{question.mission_title}</span>
        </div>
        <h2 style={{ margin: 0, color: 'var(--brand-navy)', fontSize: 'clamp(1.35rem, 3vw, 2rem)', lineHeight: 1.2, fontFamily: 'var(--font-serif-brand)' }}>
          {question.prompt}
        </h2>
        <p style={{ margin: 0, color: 'var(--brand-muted)', lineHeight: 1.7 }}>
          {question.context_text || 'Choose the best answer to continue the challenge.'}
        </p>
        <div style={{ color: 'var(--brand-subtle)', fontSize: '0.9rem' }}>
          Question {index} of {totalQuestions}
        </div>
      </div>

      <div style={{ display: 'grid', gap: '0.8rem' }}>
        {OPTION_KEYS.map((key) => (
          <button
            key={key}
            type="button"
            disabled={disabled}
            onClick={() => onSelect(key)}
            style={{
              textAlign: 'left',
              width: '100%',
              borderRadius: 22,
              border: '1px solid var(--brand-border)',
              background: disabled ? '#f5f3ee' : 'var(--brand-paper)',
              borderColor: 'var(--brand-border)',
              color: 'var(--brand-navy)',
              padding: '1rem 1.1rem',
              display: 'flex',
              alignItems: 'flex-start',
              gap: '0.9rem',
              cursor: disabled ? 'wait' : 'pointer',
              transition: 'transform 160ms ease, background 160ms ease',
            }}
          >
            <span style={optionBadgeStyle}>{key}</span>
            <span style={{ lineHeight: 1.6, fontSize: '1rem' }}>{options[key]}</span>
          </button>
        ))}
      </div>
    </section>
  )
}

const missionPillStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '0.45rem',
  padding: '0.45rem 0.8rem',
  borderRadius: 999,
  background: 'var(--brand-gold-soft)',
  color: 'var(--brand-navy)',
  fontWeight: 800,
  fontSize: '0.84rem',
}

const optionBadgeStyle: CSSProperties = {
  width: 34,
  minWidth: 34,
  height: 34,
  borderRadius: 12,
  background: 'var(--brand-gold-soft)',
  color: 'var(--brand-navy)',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontWeight: 900,
}
