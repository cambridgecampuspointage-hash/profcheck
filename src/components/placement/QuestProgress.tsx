'use client'

import type { CSSProperties } from 'react'

type QuestProgressProps = {
  currentQuestion: number
  totalQuestions: number
  currentMission: number
  totalMissions: number
  xpScore: number
  currentStreak: number
}

export function QuestProgress({
  currentQuestion,
  totalQuestions,
  currentMission,
  totalMissions,
  xpScore,
  currentStreak,
}: QuestProgressProps) {
  const progress = totalQuestions ? Math.max(0, Math.min(100, Math.round((currentQuestion / totalQuestions) * 100))) : 0

  return (
    <div style={{ display: 'grid', gap: '0.8rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', flexWrap: 'wrap' }}>
        <div style={pillStyle}>Question {currentQuestion} / {totalQuestions}</div>
        <div style={pillStyle}>Mission {currentMission} / {totalMissions}</div>
        <div style={pillStyle}>XP {xpScore}</div>
        <div style={pillStyle}>🔥 Streak {currentStreak}</div>
      </div>
      <div style={{ height: 12, borderRadius: 999, background: '#ece6da', overflow: 'hidden' }}>
        <div
          style={{
            width: `${progress}%`,
            height: '100%',
            borderRadius: 999,
            background: 'linear-gradient(90deg, #fb923c 0%, #facc15 100%)',
            boxShadow: '0 0 24px rgba(250, 204, 21, 0.45)',
          }}
        />
      </div>
    </div>
  )
}

const pillStyle: CSSProperties = {
  padding: '0.5rem 0.8rem',
  borderRadius: 999,
  background: 'var(--brand-paper)',
  border: '1px solid var(--brand-border)',
  color: 'var(--brand-navy)',
  fontWeight: 700,
  fontSize: '0.88rem',
}
