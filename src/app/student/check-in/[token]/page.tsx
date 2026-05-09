'use client'

import type { CSSProperties } from 'react'
import { use, useEffect, useState } from 'react'
import { SignaturePad } from '@/components/SignaturePad'
import { AlertTriangle, CheckCircle2, Loader2, LockKeyhole, PenLine } from 'lucide-react'

type StudentOption = {
  id: string
  full_name: string
  access_status: 'allowed' | 'blocked'
  payment_due_date?: string | null
  status: 'active' | 'inactive'
}

type CheckinPayload = {
  ok: boolean
  class?: {
    id: string
    name: string
    center_name: string | null
  }
  students?: StudentOption[]
  error?: string
}

export default function StudentCheckinPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [checkin, setCheckin] = useState<CheckinPayload | null>(null)
  const [selectedStudent, setSelectedStudent] = useState<StudentOption | null>(null)
  const [signatureDataUrl, setSignatureDataUrl] = useState('')
  const [signatureEmpty, setSignatureEmpty] = useState(true)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true

    async function load() {
      setLoading(true)
      const response = await fetch(`/api/student-checkin/${token}`, { cache: 'no-store' })
      const payload = (await response.json()) as CheckinPayload
      if (!active) return
      setCheckin(payload)
      setError(payload.ok ? '' : payload.error || 'Impossible de charger le check-in.')
      setLoading(false)
    }

    void load()

    return () => {
      active = false
    }
  }, [token])

  const isBlocked = selectedStudent?.access_status === 'blocked'

  const submit = async () => {
    if (!selectedStudent) {
      setError('Choisissez votre nom avant de signer.')
      return
    }
    if (isBlocked) {
      setError('Merci de voir l’administration')
      return
    }
    if (signatureEmpty || !signatureDataUrl) {
      setError('La signature est obligatoire.')
      return
    }

    setSubmitting(true)
    setError('')
    setMessage('')

    const response = await fetch(`/api/student-checkin/${token}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        studentId: selectedStudent.id,
        signatureDataUrl,
      }),
    })

    const payload = (await response.json()) as { ok: boolean; message?: string; error?: string }
    setSubmitting(false)

    if (!payload.ok) {
      setError(payload.error || 'Impossible d’enregistrer la présence.')
      return
    }

    setMessage(payload.message || 'Présence enregistrée.')
    setSignatureDataUrl('')
    setSignatureEmpty(true)
  }

  if (loading) {
    return (
      <main style={pageStyle}>
        <Loader2 size={42} style={{ animation: 'spin 1s linear infinite', color: '#1b2d5b' }} />
      </main>
    )
  }

  if (error && !checkin?.ok) {
    return (
      <main style={pageStyle}>
        <div className="card" style={{ width: 'min(680px, 100%)', padding: '2rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', color: '#b91c1c', marginBottom: '0.75rem' }}>
            <AlertTriangle size={22} />
            <h1 style={{ fontSize: '1.2rem', fontWeight: 800 }}>Check-in indisponible</h1>
          </div>
          <p style={{ color: '#64748b' }}>{error}</p>
        </div>
      </main>
    )
  }

  return (
    <main style={pageStyle}>
      <div className="card" style={{ width: 'min(880px, 100%)', padding: '1.5rem' }}>
        <div style={{ marginBottom: '1.25rem' }}>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--brand-navy)' }}>
            Signature étudiant
          </h1>
          <p style={{ color: '#64748b', marginTop: 6 }}>
            {checkin?.class?.name || 'Classe'}{checkin?.class?.center_name ? ` • ${checkin.class.center_name}` : ''}
          </p>
        </div>

        <div style={{ marginBottom: '1rem' }}>
          <div style={{ fontWeight: 700, marginBottom: '0.6rem' }}>Choisissez votre nom</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem' }}>
            {(checkin?.students || []).map((student) => {
              const selected = selectedStudent?.id === student.id
              return (
                <button
                  key={student.id}
                  type="button"
                  onClick={() => {
                    setSelectedStudent(student)
                    setMessage('')
                    setError(student.access_status === 'blocked' ? 'Merci de voir l’administration' : '')
                  }}
                  style={{
                    textAlign: 'left',
                    border: selected ? '1px solid #1d4ed8' : '1px solid var(--brand-border)',
                    background: selected ? 'rgba(59,130,246,0.08)' : 'white',
                    borderRadius: 16,
                    padding: '0.9rem',
                    cursor: 'pointer',
                  }}
                >
                  <div style={{ fontWeight: 700, color: 'var(--brand-navy)' }}>{student.full_name}</div>
                  <div style={{ color: student.access_status === 'blocked' ? '#b91c1c' : '#0f766e', fontSize: '0.8rem', marginTop: 4 }}>
                    {student.access_status === 'blocked' ? 'Merci de voir l’administration' : 'Accès autorisé'}
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        {selectedStudent ? (
          <div style={{
            border: '1px solid var(--brand-border)',
            borderRadius: 20,
            padding: '1rem',
            background: isBlocked ? 'rgba(239,68,68,0.05)' : '#fffdf8',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.9rem' }}>
              {isBlocked ? <LockKeyhole size={18} color="#b91c1c" /> : <PenLine size={18} color="#1b2d5b" />}
              <div style={{ fontWeight: 700, color: isBlocked ? '#b91c1c' : 'var(--brand-navy)' }}>
                {isBlocked ? 'Signature bloquée' : `Signature de ${selectedStudent.full_name}`}
              </div>
            </div>

            {isBlocked ? (
              <div style={{ color: '#b91c1c', fontWeight: 700 }}>
                Merci de voir l’administration
              </div>
            ) : (
              <>
                <SignaturePad onChange={(value, empty) => {
                  setSignatureDataUrl(value)
                  setSignatureEmpty(empty)
                }} />
                <div style={{ marginTop: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                  <span style={{ color: '#64748b', fontSize: '0.85rem' }}>
                    Votre présence sera enregistrée dès validation.
                  </span>
                  <button
                    className="btn btn-primary"
                    type="button"
                    onClick={() => void submit()}
                    disabled={submitting || signatureEmpty}
                  >
                    {submitting ? 'Validation...' : 'Signer et valider'}
                  </button>
                </div>
              </>
            )}
          </div>
        ) : null}

        {message ? (
          <div style={{ marginTop: '1rem', padding: '0.9rem 1rem', borderRadius: 14, background: 'rgba(16,185,129,0.12)', color: '#047857', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <CheckCircle2 size={18} />
            <span>{message}</span>
          </div>
        ) : null}

        {error && checkin?.ok ? (
          <div style={{ marginTop: '1rem', padding: '0.9rem 1rem', borderRadius: 14, background: 'rgba(239,68,68,0.12)', color: '#b91c1c' }}>
            {error}
          </div>
        ) : null}
      </div>
    </main>
  )
}

const pageStyle: CSSProperties = {
  minHeight: '100vh',
  background: 'linear-gradient(180deg, #fffdf8 0%, #f8fafc 100%)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '2rem 1rem',
}
