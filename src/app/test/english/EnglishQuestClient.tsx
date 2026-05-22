'use client'

import type { CSSProperties } from 'react'
import { useEffect, useMemo, useState } from 'react'
import Image from 'next/image'
import type { PlacementQuestionPublic } from '@/lib/types'
import { QuestProgress } from '@/components/placement/QuestProgress'
import { QuestWelcome } from '@/components/placement/QuestWelcome'
import { QuestionMissionCard } from '@/components/placement/QuestionMissionCard'
import { ResultBadge } from '@/components/placement/ResultBadge'
import { XPBadge } from '@/components/placement/XPBadge'

type Stage = 'loading' | 'welcome' | 'profile' | 'mission' | 'result'
type Audience = 'junior' | 'adult'

type ResultPayload = {
  score: number
  xp: number
  badge: string
  estimatedLevel: string
  recommendedClass: string
  bestStreak: number
  summary?: string
  completedAt?: string
}

const SUCCESS_MESSAGES = [
  'Great job! Keep going.',
  'Nice! You are getting closer to your level badge.',
  'Strong move. Next mission.',
]

const NEUTRAL_MESSAGES = [
  'Nice try! Next challenge 💪',
  'Keep going. The next one can change your streak.',
  'Good effort. Stay focused for the next mission.',
]

export function EnglishQuestClient() {
  const [stage, setStage] = useState<Stage>('loading')
  const [questions, setQuestions] = useState<PlacementQuestionPublic[]>([])
  const [loadingError, setLoadingError] = useState('')
  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [age, setAge] = useState('')
  const [audience, setAudience] = useState<Audience>('adult')
  const [attemptId, setAttemptId] = useState<string | null>(null)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [submitting, setSubmitting] = useState(false)
  const [xpScore, setXpScore] = useState(0)
  const [currentStreak, setCurrentStreak] = useState(0)
  const [feedbackMessage, setFeedbackMessage] = useState('You’re getting closer to your level badge.')
  const [feedbackTone, setFeedbackTone] = useState<'success' | 'neutral'>('neutral')
  const [result, setResult] = useState<ResultPayload | null>(null)

  useEffect(() => {
    let active = true

    async function bootstrap() {
      const response = await fetch('/api/placement/english', { cache: 'no-store' })
      const payload = await response.json().catch(() => null)

      if (!active) return

      if (!response.ok || !payload?.ok) {
        setLoadingError(payload?.error || 'Impossible de charger le test.')
        setStage('welcome')
        return
      }

      setQuestions(payload.questions || [])
      setStage('welcome')
    }

    void bootstrap()
    return () => {
      active = false
    }
  }, [])

  const currentQuestion = questions[currentIndex]
  const totalMissions = useMemo(() => new Set(questions.map((question) => question.mission_order)).size, [questions])
  const currentMission = currentQuestion?.mission_order || 1
  const whatsappHref = useMemo(() => {
    const centerWhatsapp = process.env.NEXT_PUBLIC_CENTER_WHATSAPP?.replace(/\D/g, '')
    return centerWhatsapp ? `https://wa.me/${centerWhatsapp}` : null
  }, [])

  async function handleStartQuest() {
    setSubmitting(true)
    setLoadingError('')

    const response = await fetch('/api/placement/english', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        fullName,
        phone,
        age: age ? Number(age) : null,
        audience,
      }),
    })

    const payload = await response.json().catch(() => null)
    setSubmitting(false)

    if (!response.ok || !payload?.ok) {
      setLoadingError(payload?.error || 'Impossible de démarrer le test.')
      return
    }

    setAttemptId(payload.attemptId)
    setCurrentIndex(0)
    setXpScore(0)
    setCurrentStreak(0)
    setFeedbackMessage('You’re getting closer to your level badge.')
    setFeedbackTone('neutral')

    if (payload.existingAttempt && payload.result) {
      setResult(payload.result)
      setStage('result')
      return
    }

    setStage('mission')
  }

  async function handleAnswer(option: 'A' | 'B' | 'C' | 'D') {
    if (!attemptId || !currentQuestion || submitting) return

    setSubmitting(true)
    const response = await fetch(`/api/placement/english/${attemptId}/answer`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        questionId: currentQuestion.id,
        selectedOption: option,
      }),
    })
    const payload = await response.json().catch(() => null)

    if (!response.ok || !payload?.ok) {
      setSubmitting(false)
      setLoadingError(payload?.error || 'Impossible d’enregistrer la réponse.')
      return
    }

    setXpScore(payload.xpScore || 0)
    setCurrentStreak(payload.currentStreak || 0)
    setFeedbackTone(payload.correct ? 'success' : 'neutral')
    setFeedbackMessage(
      payload.correct
        ? SUCCESS_MESSAGES[currentIndex % SUCCESS_MESSAGES.length]
        : NEUTRAL_MESSAGES[currentIndex % NEUTRAL_MESSAGES.length],
    )

    const isLastQuestion = currentIndex >= questions.length - 1
    if (isLastQuestion) {
      const completionResponse = await fetch(`/api/placement/english/${attemptId}/complete`, {
        method: 'POST',
      })
      const completionPayload = await completionResponse.json().catch(() => null)
      setSubmitting(false)

      if (!completionResponse.ok || !completionPayload?.ok) {
        setLoadingError(completionPayload?.error || 'Impossible de terminer le test.')
        return
      }

      setResult(completionPayload.result)
      setStage('result')
      return
    }

    window.setTimeout(() => {
      setCurrentIndex((value) => value + 1)
      setSubmitting(false)
    }, 420)
  }

  function resetQuest() {
    setAttemptId(null)
    setCurrentIndex(0)
    setXpScore(0)
    setCurrentStreak(0)
    setFeedbackMessage('You’re getting closer to your level badge.')
    setFeedbackTone('neutral')
    setResult(null)
    setStage('welcome')
  }

  return (
    <div style={pageStyle}>
      <div style={orbOneStyle} />
      <div style={orbTwoStyle} />
      <div style={gridGlowStyle} />

      <main style={shellStyle} className="quest-shell">
        <section style={heroPanelStyle} className="quest-main-panel">
          <div className="quest-brand-row">
            <div className="quest-brand-block">
              <div className="quest-logo-circle">
                <Image src="/cambridge_campus_rabat_logo.png" alt="Cambridge Campus" width={34} height={34} />
              </div>
              <div>
                <div className="quest-brand-title">Cambridge Campus</div>
                <div className="quest-brand-subtitle">ProfCheck · English Quest</div>
              </div>
            </div>
            <div className="quest-brand-tag">Practice Makes Perfect</div>
          </div>

          {stage === 'welcome' || stage === 'loading' ? (
            <QuestWelcome onStart={() => setStage('profile')} />
          ) : stage === 'profile' ? (
            <section style={{ display: 'grid', gap: '1.2rem' }}>
              <div style={{ color: 'var(--brand-gold)', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.08em', fontSize: '0.82rem' }}>
                Student Information
              </div>
              <h1 style={{ margin: 0, color: 'var(--brand-navy)', fontSize: 'clamp(2rem, 6vw, 3.6rem)', lineHeight: 0.96, fontFamily: 'var(--font-serif-brand)' }}>
                Start my English Quest
              </h1>
              <p style={{ margin: 0, color: 'var(--brand-muted)', lineHeight: 1.7 }}>
                Add a few details to create your profile and unlock the missions.
              </p>

              <div style={formGridStyle}>
                <label style={fieldStyle}>
                  <span>Full name</span>
                  <input style={inputStyle} value={fullName} onChange={(event) => setFullName(event.target.value)} />
                </label>
                <label style={fieldStyle}>
                  <span>Phone / WhatsApp</span>
                  <input style={inputStyle} value={phone} onChange={(event) => setPhone(event.target.value)} />
                </label>
                <label style={fieldStyle}>
                  <span>Age</span>
                  <input style={inputStyle} type="number" min="3" max="99" value={age} onChange={(event) => setAge(event.target.value)} />
                </label>
                <label style={fieldStyle}>
                  <span>Journey</span>
                  <select style={inputStyle} value={audience} onChange={(event) => setAudience(event.target.value as Audience)}>
                    <option value="adult">Adult</option>
                    <option value="junior">Junior</option>
                  </select>
                </label>
              </div>

              {loadingError ? <div style={errorStyle}>{loadingError}</div> : null}

              <div style={{ display: 'flex', gap: '0.8rem', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={handleStartQuest}
                  disabled={submitting || !fullName.trim() || !phone.trim()}
                  style={primaryButtonStyle}
                >
                  {submitting ? 'Preparing your quest...' : 'Start my English Quest'}
                </button>
                <button type="button" onClick={() => setStage('welcome')} style={ghostButtonStyle}>
                  Back
                </button>
              </div>
            </section>
          ) : stage === 'mission' && currentQuestion ? (
            <section style={{ display: 'grid', gap: '1rem' }}>
              <QuestProgress
                currentQuestion={currentIndex + 1}
                totalQuestions={questions.length}
                currentMission={currentMission}
                totalMissions={totalMissions}
                xpScore={xpScore}
                currentStreak={currentStreak}
              />
              <QuestionMissionCard
                question={currentQuestion}
                index={currentIndex + 1}
                totalQuestions={questions.length}
                disabled={submitting}
                onSelect={handleAnswer}
              />
              <XPBadge xp={xpScore} streak={currentStreak} message={feedbackMessage} tone={feedbackTone} />
              {loadingError ? <div style={errorStyle}>{loadingError}</div> : null}
            </section>
          ) : result ? (
            <ResultBadge
              fullName={fullName}
              badge={result.badge}
              estimatedLevel={result.estimatedLevel}
              xp={result.xp}
              score={result.score}
              recommendedClass={result.recommendedClass}
              summary={result.summary || 'Cambridge Campus will contact you to recommend the best group.'}
              bestStreak={result.bestStreak}
              completedAt={result.completedAt}
              whatsappHref={whatsappHref}
              onRestart={resetQuest}
            />
          ) : null}
        </section>

        <aside style={sidePanelStyle} className="quest-side-panel">
          <div style={{ display: 'grid', gap: '1rem' }}>
            <div style={sideCardStyle}>
              <div style={sideLabelStyle}>Level Badges</div>
              <div style={{ display: 'grid', gap: '0.6rem' }}>
                {[
                  ['Explorer', 'Pre-A1'],
                  ['Starter', 'A1'],
                  ['Traveler', 'A2'],
                  ['Communicator', 'B1'],
                  ['Achiever', 'B2'],
                  ['Master', 'C1'],
                ].map(([badge, level]) => (
                  <div key={badge} style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', color: 'var(--brand-navy)' }}>
                    <strong>{badge}</strong>
                    <span style={{ color: 'var(--brand-gold)' }}>{level}</span>
                  </div>
                ))}
              </div>
            </div>

            <div style={sideCardStyle}>
              <div style={sideLabelStyle}>Quest Path</div>
              <div style={{ color: 'var(--brand-muted)', lineHeight: 1.8 }}>
                Start → Missions → Score → Level Badge → Recommended Class
              </div>
            </div>

            <div style={sideCardStyle}>
              <div style={sideLabelStyle}>Why this feels better</div>
              <div style={{ color: 'var(--brand-muted)', lineHeight: 1.75 }}>
                One question at a time, big choices, clear progress, and a result that feels like an achievement instead of an exam.
              </div>
            </div>
          </div>
        </aside>
      </main>

      <style jsx>{`
        .quest-shell {
          grid-template-columns: minmax(0, 1.35fr) minmax(300px, 0.65fr);
        }

        .quest-brand-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 1rem;
          flex-wrap: wrap;
          margin-bottom: 1.35rem;
          padding-bottom: 1rem;
          border-bottom: 1px solid var(--brand-border);
        }

        .quest-brand-block {
          display: flex;
          align-items: center;
          gap: 0.85rem;
        }

        .quest-logo-circle {
          width: 54px;
          height: 54px;
          border-radius: 18px;
          background: linear-gradient(180deg, var(--brand-paper), #f2ecdf);
          border: 1px solid var(--brand-border);
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 12px 30px rgba(27, 45, 91, 0.08);
        }

        .quest-brand-title {
          font-family: var(--font-serif-brand);
          color: var(--brand-navy);
          font-size: 1.2rem;
          font-weight: 800;
          line-height: 1.1;
        }

        .quest-brand-subtitle {
          color: var(--brand-muted);
          font-size: 0.9rem;
          margin-top: 0.15rem;
        }

        .quest-brand-tag {
          padding: 0.5rem 0.85rem;
          border-radius: 999px;
          background: var(--brand-gold-soft);
          color: var(--brand-navy);
          font-size: 0.82rem;
          font-weight: 800;
          letter-spacing: 0.06em;
          text-transform: uppercase;
        }

        @media (max-width: 980px) {
          .quest-shell {
            grid-template-columns: 1fr;
          }

          .quest-side-panel {
            order: 2;
          }
        }

        @media (max-width: 640px) {
          .quest-shell {
            width: min(100% - 1rem, 1200px);
            padding: 0.75rem 0 1rem;
            gap: 0.75rem;
          }

          .quest-main-panel {
            padding: 1rem;
            border-radius: 24px;
          }

          .quest-side-panel > div {
            gap: 0.75rem !important;
          }

          .quest-brand-row {
            margin-bottom: 1rem;
            padding-bottom: 0.85rem;
          }

          .quest-brand-title {
            font-size: 1.05rem;
          }

          .quest-brand-subtitle {
            font-size: 0.82rem;
          }

          .quest-brand-tag {
            width: 100%;
            text-align: center;
          }
        }
      `}</style>
    </div>
  )
}

const pageStyle: CSSProperties = {
  minHeight: '100vh',
  position: 'relative',
  overflow: 'hidden',
  background: 'linear-gradient(180deg, var(--brand-cream) 0%, #f7f1e7 100%)',
}

const shellStyle: CSSProperties = {
  position: 'relative',
  zIndex: 1,
  width: 'min(1200px, calc(100% - 2rem))',
  margin: '0 auto',
  padding: '2rem 0',
  display: 'grid',
  gap: '1.2rem',
}

const heroPanelStyle: CSSProperties = {
  padding: 'clamp(1.2rem, 3vw, 2.2rem)',
  borderRadius: 34,
  background: 'linear-gradient(180deg, var(--brand-paper) 0%, #fffaf0 100%)',
  border: '1px solid var(--brand-border)',
  boxShadow: '0 30px 80px rgba(27, 45, 91, 0.08)',
}

const sidePanelStyle: CSSProperties = {
  display: 'grid',
  alignContent: 'start',
}

const sideCardStyle: CSSProperties = {
  padding: '1.1rem',
  borderRadius: 26,
  background: 'var(--brand-paper)',
  border: '1px solid var(--brand-border)',
}

const sideLabelStyle: CSSProperties = {
  color: 'var(--brand-gold)',
  fontWeight: 900,
  marginBottom: '0.8rem',
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  fontSize: '0.78rem',
}

const formGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
  gap: '0.9rem',
}

const fieldStyle: CSSProperties = {
  display: 'grid',
  gap: '0.4rem',
  color: 'var(--brand-navy)',
  fontWeight: 700,
}

const inputStyle: CSSProperties = {
  borderRadius: 18,
  border: '1px solid var(--brand-border)',
  background: 'var(--brand-paper)',
  color: 'var(--brand-navy)',
  padding: '0.95rem 1rem',
  outline: 'none',
}

const primaryButtonStyle: CSSProperties = {
  border: 0,
  borderRadius: 18,
  background: 'linear-gradient(135deg, var(--brand-navy) 0%, var(--brand-navy-soft) 100%)',
  color: '#fff',
  fontWeight: 800,
  padding: '1rem 1.2rem',
  cursor: 'pointer',
}

const ghostButtonStyle: CSSProperties = {
  borderRadius: 18,
  border: '1px solid var(--brand-border)',
  background: 'var(--brand-paper)',
  color: 'var(--brand-navy)',
  fontWeight: 800,
  padding: '1rem 1.2rem',
  cursor: 'pointer',
}

const errorStyle: CSSProperties = {
  padding: '0.85rem 1rem',
  borderRadius: 18,
  background: '#fef2f2',
  border: '1px solid #fecaca',
  color: '#b91c1c',
}

const orbOneStyle: CSSProperties = {
  position: 'absolute',
  width: 420,
  height: 420,
  borderRadius: '50%',
  background: 'radial-gradient(circle, rgba(201,168,76,0.22) 0%, rgba(201,168,76,0) 70%)',
  top: -80,
  left: -40,
  filter: 'blur(20px)',
}

const orbTwoStyle: CSSProperties = {
  position: 'absolute',
  width: 360,
  height: 360,
  borderRadius: '50%',
  background: 'radial-gradient(circle, rgba(27,45,91,0.12) 0%, rgba(27,45,91,0) 70%)',
  bottom: -80,
  right: -20,
  filter: 'blur(22px)',
}

const gridGlowStyle: CSSProperties = {
  position: 'absolute',
  inset: 0,
  backgroundImage: 'linear-gradient(rgba(27,45,91,0.035) 1px, transparent 1px), linear-gradient(90deg, rgba(27,45,91,0.035) 1px, transparent 1px)',
  backgroundSize: '48px 48px',
  maskImage: 'radial-gradient(circle at center, black 45%, transparent 100%)',
  opacity: 0.35,
}
