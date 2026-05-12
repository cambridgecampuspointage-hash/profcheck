'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { SignaturePad } from '@/components/SignaturePad'
import { createClient } from '@/lib/supabase/client'
import { DayAttendanceCard } from '@/app/dashboard/reception/components/DayAttendanceCard'
import { findScheduleForDate } from '@/lib/reception/computeReceptionKpis'
import type { StaffAttendance, StaffSchedule } from '@/types/reception'

type Profile = {
  id: string
  role: 'admin' | 'teacher' | 'reception'
  full_name: string | null
}

function getLocalDateParts(date = new Date()) {
  const year = String(date.getFullYear())
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return { year, month, day }
}

function todayInLocalTimezone() {
  const { year, month, day } = getLocalDateParts()
  return `${year}-${month}-${day}`
}

function dateObjectInLocalTimezone(date = new Date()) {
  const { year, month, day } = getLocalDateParts(date)
  return new Date(Number(year), Number(month) - 1, Number(day))
}

function formatTodayLabelInLocalTimezone() {
  return dateObjectInLocalTimezone().toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

function currentLocalTime() {
  const now = new Date()
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
}

function timeToMinutes(value: string) {
  const [hours, minutes] = value.slice(0, 5).split(':').map(Number)
  return ((hours || 0) * 60) + (minutes || 0)
}

export default function ReceptionClockingPage() {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])
  const [profile, setProfile] = useState<Profile | null>(null)
  const [schedule, setSchedule] = useState<StaffSchedule | null>(null)
  const [attendance, setAttendance] = useState<StaffAttendance | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [signatureModalOpen, setSignatureModalOpen] = useState(false)
  const [signatureDataUrl, setSignatureDataUrl] = useState('')
  const [signatureEmpty, setSignatureEmpty] = useState(true)
  const [nowTick, setNowTick] = useState(() => Date.now())

  const loadState = useCallback(async () => {
    setLoading(true)

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      router.replace('/login')
      return
    }

    const { data: currentProfile, error: profileError } = await supabase
      .from('profiles')
      .select('id, role, full_name')
      .eq('id', user.id)
      .single()

    if (profileError || !currentProfile) {
      setError(profileError?.message || 'Profil introuvable.')
      setLoading(false)
      return
    }

    if (currentProfile.role !== 'reception' && currentProfile.role !== 'admin') {
      router.replace('/dashboard')
      return
    }

    setProfile(currentProfile as Profile)

    const today = todayInLocalTimezone()
    const [schedulesResult, attendanceResult] = await Promise.all([
      supabase
        .from('staff_schedules')
        .select('*, profile:profiles!staff_schedules_user_id_fkey(id, full_name, email, role)')
        .eq('user_id', currentProfile.id),
      supabase
        .from('staff_attendance')
        .select('*')
        .eq('user_id', currentProfile.id)
        .eq('date', today)
        .maybeSingle(),
    ])

    if (schedulesResult.error || attendanceResult.error) {
      setError(schedulesResult.error?.message || attendanceResult.error?.message || 'Chargement impossible.')
      setLoading(false)
      return
    }

    setSchedule(findScheduleForDate((schedulesResult.data || []) as unknown as StaffSchedule[], dateObjectInLocalTimezone()))
    setAttendance((attendanceResult.data || null) as StaffAttendance | null)
    setLoading(false)
  }, [router, supabase])

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadState()
    }, 0)

    return () => window.clearTimeout(timeoutId)
  }, [loadState])

  useEffect(() => {
    if (!(attendance?.break_start && !attendance.break_end && !attendance.clock_out)) {
      return
    }

    const intervalId = window.setInterval(() => {
      setNowTick(Date.now())
    }, 1000)

    return () => window.clearInterval(intervalId)
  }, [attendance?.break_end, attendance?.break_start, attendance?.clock_out])

  const runAction = async (endpoint: string, body?: Record<string, unknown>) => {
    setSubmitting(endpoint)
    setMessage(null)
    setError(null)

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: body ? { 'Content-Type': 'application/json' } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      })
      const payload = (await response.json()) as {
        ok: boolean
        message?: string
        error?: string
        attendance?: StaffAttendance
      }

      if (!payload.ok) {
        console.error('[clock-in error]', payload.error)
        setError(payload.error || 'Action impossible.')
      } else {
        setMessage(payload.message || 'Action enregistrée.')
      }

      await loadState()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Erreur réseau.')
    } finally {
      setSubmitting(null)
    }
  }

  const submitClockIn = async () => {
    if (signatureEmpty || !signatureDataUrl) {
      setError("La signature est obligatoire avant de pointer l'arrivée.")
      return
    }

    await runAction('/api/reception/clock-in', {
      signatureDataUrl,
      clientDate: todayInLocalTimezone(),
      clientTime: currentLocalTime(),
    })

    if (!error) {
      setSignatureModalOpen(false)
      setSignatureDataUrl('')
      setSignatureEmpty(true)
    }
  }

  if (loading) {
    return <PageState label="Chargement du pointage..." />
  }

  const canClockIn = Boolean(schedule && !attendance?.clock_in)
  const nowTime = currentLocalTime()
  const earliestClockInTime = schedule
    ? `${String(Math.floor((timeToMinutes(schedule.expected_start) - 20) / 60)).padStart(2, '0')}:${String((timeToMinutes(schedule.expected_start) - 20) % 60).padStart(2, '0')}`
    : null
  const clockInWindowOpen = schedule
    ? timeToMinutes(nowTime) >= (timeToMinutes(schedule.expected_start) - 20)
    : false
  const canStartBreak = Boolean(attendance?.clock_in && !attendance.clock_out && (!attendance.break_start || attendance.break_end))
  const canEndBreak = Boolean(attendance?.break_start && !attendance.break_end && !attendance.clock_out)
  const canClockOut = Boolean(attendance?.clock_in && !attendance.clock_out)
  const todayLabel = formatTodayLabelInLocalTimezone()
  const breakTimerLabel = (() => {
    if (!(attendance?.break_start && !attendance.break_end && !attendance.clock_out)) {
      return null
    }

    const breakStartTimestamp = new Date(attendance.break_start).getTime()
    if (Number.isNaN(breakStartTimestamp)) return null

    const elapsedSeconds = Math.max(0, Math.floor((nowTick - breakStartTimestamp) / 1000))
    const hours = Math.floor(elapsedSeconds / 3600)
    const minutes = Math.floor((elapsedSeconds % 3600) / 60)
    const seconds = elapsedSeconds % 60

    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
  })()

  return (
    <div style={pageStyle}>
      <div style={containerStyle}>
        <div>
          <Link href="/reception/dashboard" style={backLinkStyle}>
            ← Retour au tableau de bord
          </Link>
        </div>

        <header style={heroStyle}>
          <div>
            <div style={eyebrowStyle}>Administration</div>
            <h1 style={titleStyle}>
              Bonjour{profile?.full_name ? `, ${profile.full_name.split(' ')[0]}` : ''}
            </h1>
            <p style={subtitleStyle}>{todayLabel}</p>
          </div>
          <div style={pillStyle}>
            {schedule ? `${schedule.expected_start.slice(0, 5)} → ${schedule.expected_end.slice(0, 5)}` : 'Aucun horaire prévu'}
          </div>
        </header>

        {message ? <div style={successStyle}>{message}</div> : null}
        {error ? <div style={errorStyle}>{error}</div> : null}

        <div style={gridStyle}>
          <DayAttendanceCard
            title="Ma journée"
            schedule={schedule}
            attendance={attendance}
          />

          <section style={cardStyle}>
            <div style={{ color: '#1B2D5B', fontWeight: 800, fontSize: '1.05rem', marginBottom: '1rem' }}>
              Actions rapides
            </div>

            {breakTimerLabel ? (
              <div style={timerCardStyle}>
                <div style={{ color: '#8B7D6B', fontSize: '0.82rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  Pause en cours
                </div>
                <div style={{ color: '#1B2D5B', fontSize: '2rem', fontWeight: 800, marginTop: '0.35rem' }}>
                  {breakTimerLabel}
                </div>
              </div>
            ) : null}

            <div style={{ display: 'grid', gap: '0.85rem' }}>
              <ActionButton
                label="Pointer l’arrivée"
                hint={
                  schedule && !attendance?.clock_in && !clockInWindowOpen && earliestClockInTime
                    ? `Disponible à partir de ${earliestClockInTime}`
                    : 'Enregistre le début de journée'
                }
                onClick={() => {
                  setMessage(null)
                  setError(null)
                  setSignatureModalOpen(true)
                }}
                disabled={!canClockIn || !clockInWindowOpen}
                loading={submitting === '/api/reception/clock-in'}
              />
              <ActionButton
                label="Début de pause"
                hint="Pause fixe entre 13h00 et 14h00"
                onClick={() => void runAction('/api/reception/break-start')}
                disabled={!canStartBreak}
                loading={submitting === '/api/reception/break-start'}
              />
              <ActionButton
                label="Fin de pause"
                hint="Reprise d&apos;activité"
                onClick={() => void runAction('/api/reception/break-end')}
                disabled={!canEndBreak}
                loading={submitting === '/api/reception/break-end'}
              />
              <ActionButton
                label="Pointer le départ"
                hint="Clôture la journée"
                onClick={() => void runAction('/api/reception/clock-out')}
                disabled={!canClockOut}
                loading={submitting === '/api/reception/clock-out'}
              />
            </div>
          </section>
        </div>
      </div>

      {signatureModalOpen ? (
        <div style={overlayStyle}>
          <div style={modalStyle}>
            <div style={{ color: '#1B2D5B', fontWeight: 800, fontSize: '1.1rem', marginBottom: '0.35rem' }}>
              Signature d&apos;arrivée
            </div>
            <div style={{ color: '#8B7D6B', marginBottom: '1rem' }}>
              Signez avant de confirmer votre pointage d&apos;arrivée.
            </div>

            <SignaturePad
              onChange={(value, isEmpty) => {
                setSignatureDataUrl(value)
                setSignatureEmpty(isEmpty)
              }}
            />

            {error && submitting !== '/api/reception/clock-in' ? (
              <div style={{ ...errorStyle, marginTop: '0.75rem' }}>{error}</div>
            ) : null}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1rem', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => {
                  if (submitting !== '/api/reception/clock-in') {
                    setSignatureModalOpen(false)
                    setSignatureDataUrl('')
                    setSignatureEmpty(true)
                  }
                }}
                style={secondaryModalButtonStyle}
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={() => void submitClockIn()}
                disabled={signatureEmpty || submitting === '/api/reception/clock-in'}
                style={{
                  ...primaryModalButtonStyle,
                  opacity: signatureEmpty || submitting === '/api/reception/clock-in' ? 0.55 : 1,
                  cursor: signatureEmpty || submitting === '/api/reception/clock-in' ? 'not-allowed' : 'pointer',
                }}
              >
                {submitting === '/api/reception/clock-in' ? 'Enregistrement...' : "Confirmer l'arrivée"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

function ActionButton({
  label,
  hint,
  onClick,
  disabled,
  loading,
}: {
  label: string
  hint: string
  onClick: () => void
  disabled: boolean
  loading: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || loading}
      style={{
        ...actionButtonStyle,
        opacity: disabled || loading ? 0.55 : 1,
        cursor: disabled || loading ? 'not-allowed' : 'pointer',
      }}
    >
      <span style={{ display: 'block', fontWeight: 800 }}>{loading ? 'Enregistrement...' : label}</span>
      <span style={{ display: 'block', color: '#8B7D6B', fontSize: '0.86rem', marginTop: '0.25rem' }}>{hint}</span>
    </button>
  )
}

function PageState({ label }: { label: string }) {
  return (
    <div style={pageStyle}>
      <div style={{ ...containerStyle, color: '#1B2D5B', fontWeight: 700 }}>{label}</div>
    </div>
  )
}

const pageStyle = {
  minHeight: '100vh',
  background: '#FAF8F3',
  padding: '2rem 1rem',
}

const containerStyle = {
  maxWidth: 1100,
  margin: '0 auto',
  display: 'grid',
  gap: '1rem',
}

const heroStyle = {
  background: 'linear-gradient(135deg, #1B2D5B 0%, #243B73 100%)',
  color: '#FFFFFF',
  borderRadius: 28,
  padding: '1.4rem 1.5rem',
  display: 'flex',
  justifyContent: 'space-between',
  gap: '1rem',
  flexWrap: 'wrap' as const,
  alignItems: 'center',
}

const eyebrowStyle = {
  color: '#C9A84C',
  fontSize: '0.8rem',
  textTransform: 'uppercase' as const,
  letterSpacing: '0.08em',
  fontWeight: 800,
}

const titleStyle = {
  margin: '0.35rem 0 0',
  fontSize: '1.9rem',
  fontWeight: 800,
}

const subtitleStyle = {
  margin: '0.35rem 0 0',
  color: 'rgba(255,255,255,0.8)',
}

const pillStyle = {
  border: '1px solid rgba(255,255,255,0.18)',
  background: 'rgba(255,255,255,0.08)',
  borderRadius: 999,
  padding: '0.75rem 1rem',
  fontWeight: 800,
}

const gridStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
  gap: '1rem',
}

const cardStyle = {
  background: '#FFFFFF',
  border: '1px solid #E8E2D5',
  borderRadius: 24,
  padding: '1.1rem',
}

const actionButtonStyle = {
  width: '100%',
  border: '1px solid #E8E2D5',
  background: '#FFFFFF',
  color: '#1B2D5B',
  borderRadius: 20,
  padding: '1rem',
  textAlign: 'left' as const,
  transition: 'transform 0.15s ease, box-shadow 0.15s ease',
  boxShadow: '0 10px 22px rgba(27,45,91,0.06)',
}

const successStyle = {
  border: '1px solid rgba(15,110,86,0.18)',
  background: 'rgba(15,110,86,0.1)',
  color: '#0F6E56',
  borderRadius: 18,
  padding: '0.9rem 1rem',
  fontWeight: 700,
}

const errorStyle = {
  border: '1px solid rgba(229,62,62,0.18)',
  background: 'rgba(229,62,62,0.08)',
  color: '#E53E3E',
  borderRadius: 18,
  padding: '0.9rem 1rem',
  fontWeight: 700,
}

const backLinkStyle = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '0.45rem',
  textDecoration: 'none',
  color: '#1B2D5B',
  fontWeight: 800,
  border: '1px solid #E8E2D5',
  background: '#FFFFFF',
  borderRadius: 999,
  padding: '0.7rem 1rem',
}

const overlayStyle = {
  position: 'fixed' as const,
  inset: 0,
  background: 'rgba(27,45,91,0.35)',
  display: 'grid',
  placeItems: 'center',
  zIndex: 80,
  padding: '1rem',
}

const modalStyle = {
  width: 'min(560px, 100%)',
  background: '#FFFFFF',
  border: '1px solid #E8E2D5',
  borderRadius: 24,
  padding: '1.2rem',
  boxShadow: '0 20px 48px rgba(27,45,91,0.16)',
}

const secondaryModalButtonStyle = {
  border: '1px solid #E8E2D5',
  background: '#FFFFFF',
  color: '#1B2D5B',
  borderRadius: 14,
  padding: '0.75rem 1rem',
  fontWeight: 700,
  cursor: 'pointer',
}

const primaryModalButtonStyle = {
  border: '1px solid #C9A84C',
  background: '#1B2D5B',
  color: '#FFFFFF',
  borderRadius: 14,
  padding: '0.75rem 1rem',
  fontWeight: 800,
}

const timerCardStyle = {
  border: '1px solid rgba(201,168,76,0.25)',
  background: 'linear-gradient(135deg, rgba(201,168,76,0.12) 0%, rgba(27,45,91,0.05) 100%)',
  borderRadius: 20,
  padding: '1rem 1.1rem',
  marginBottom: '1rem',
}
