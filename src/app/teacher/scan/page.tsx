'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { BrowserQRCodeReader } from '@zxing/browser'
import { resolveAttendanceCode, validateAttendanceScan } from '@/lib/actions'
import { getCurrentPosition, getGeoErrorMessage } from '@/lib/gps'
import type { QrPayload } from '@/lib/types'
import { SignaturePad } from '@/components/SignaturePad'
import {
  Camera,
  MapPin,
  CheckCircle,
  XCircle,
  Loader2,
  Play,
  Square,
  ArrowLeft,
  Keyboard,
  PenTool,
  Clock3,
} from 'lucide-react'
import Link from 'next/link'

type ScanStep = 'scanning' | 'choose-action' | 'start-setup' | 'processing' | 'result'

export default function ScanPage() {
  const [step, setStep] = useState<ScanStep>('scanning')
  const [qrPayload, setQrPayload] = useState<QrPayload | null>(null)
  const [action, setAction] = useState<'start' | 'end' | null>(null)
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null)
  const [cameraError, setCameraError] = useState('')
  const [scanAttempt, setScanAttempt] = useState(0)
  const [manualCode, setManualCode] = useState('')
  const [manualError, setManualError] = useState('')
  const [manualLoading, setManualLoading] = useState(false)
  const [plannedDuration, setPlannedDuration] = useState<60 | 90 | 120 | 180>(60)
  const [sessionType, setSessionType] = useState<'standard' | 'one_to_one'>('standard')
  const [signatureDataUrl, setSignatureDataUrl] = useState('')
  const [signatureEmpty, setSignatureEmpty] = useState(true)
  const [startSetupError, setStartSetupError] = useState('')
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const scanningRef = useRef(false)

  const stopCamera = useCallback(() => {
    scanningRef.current = false
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop())
      streamRef.current = null
    }
  }, [])

  const scanFrames = useCallback(() => {
    const reader = new BrowserQRCodeReader()

    const tick = () => {
      if (!scanningRef.current || !videoRef.current || !canvasRef.current) return

      const video = videoRef.current
      const canvas = canvasRef.current
      const ctx = canvas.getContext('2d')

      if (video.readyState === video.HAVE_ENOUGH_DATA && ctx) {
        canvas.width = video.videoWidth
        canvas.height = video.videoHeight
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height)

        try {
          const decoded = reader.decodeFromCanvas(canvas)
          const payload: QrPayload = JSON.parse(decoded.getText())

          if (payload.token && payload.center_id && payload.room_id) {
            scanningRef.current = false
            stopCamera()
            setQrPayload(payload)
            setStep('choose-action')
            return
          }
        } catch {
          // No QR found in frame, keep scanning.
        }
      }

      if (scanningRef.current) {
        setTimeout(tick, 250)
      }
    }

    tick()
  }, [stopCamera])

  useEffect(() => {
    if (step !== 'scanning') {
      stopCamera()
      return
    }

    let cancelled = false

    async function setupCamera() {
      setCameraError('')

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment', width: { ideal: 720 }, height: { ideal: 720 } },
        })

        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop())
          return
        }

        streamRef.current = stream

        if (videoRef.current) {
          videoRef.current.srcObject = stream
          await videoRef.current.play()
          if (cancelled) return
          scanningRef.current = true
          scanFrames()
        }
      } catch {
        if (!cancelled) {
          setCameraError('Caméra non autorisée. Veuillez autoriser l\'accès à la caméra.')
        }
      }
    }

    void setupCamera()

    return () => {
      cancelled = true
      stopCamera()
    }
  }, [scanAttempt, scanFrames, step, stopCamera])

  const handleAction = async (selectedAction: 'start' | 'end') => {
    if (!qrPayload) return

    if (selectedAction === 'start') {
      setAction('start')
      setStartSetupError('')
      setStep('start-setup')
      return
    }

    setAction(selectedAction)
    setStep('processing')

    try {
      const position = await getCurrentPosition()
      const res = await validateAttendanceScan(
        qrPayload.token,
        qrPayload.center_id,
        qrPayload.room_id,
        selectedAction,
        position.coords.latitude,
        position.coords.longitude,
        {
          gpsAccuracyMeters: position.coords.accuracy,
        }
      )
      setResult(res)
      setStep('result')
    } catch (error) {
      if (error instanceof GeolocationPositionError) {
        setResult({ success: false, message: getGeoErrorMessage(error) })
      } else {
        setResult({ success: false, message: 'Localisation obligatoire. Veuillez autoriser l\'accès GPS.' })
      }
      setStep('result')
    }
  }

  const handleStartSession = async () => {
    if (!qrPayload) return
    if (signatureEmpty || !signatureDataUrl) {
      setStartSetupError('La signature est obligatoire avant de commencer.')
      return
    }

    setStartSetupError('')
    setAction('start')
    setStep('processing')

    try {
      const position = await getCurrentPosition()
      const res = await validateAttendanceScan(
        qrPayload.token,
        qrPayload.center_id,
        qrPayload.room_id,
        'start',
        position.coords.latitude,
        position.coords.longitude,
        {
          gpsAccuracyMeters: position.coords.accuracy,
          plannedDurationMinutes: plannedDuration,
          sessionType,
          signatureDataUrl,
        }
      )
      setResult(res)
      setStep('result')
    } catch (error) {
      if (error instanceof GeolocationPositionError) {
        setResult({ success: false, message: getGeoErrorMessage(error) })
      } else {
        setResult({ success: false, message: 'Localisation obligatoire. Veuillez autoriser l\'accès GPS.' })
      }
      setStep('result')
    }
  }

  const handleManualCodeSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setManualError('')
    setManualLoading(true)

    const result = await resolveAttendanceCode(manualCode)
    setManualLoading(false)

    if (result.error || !result.data) {
      setManualError(result.error || 'Code invalide.')
      return
    }

    stopCamera()
    setQrPayload(result.data)
    setStep('choose-action')
  }

  const resetScan = () => {
    stopCamera()
    setQrPayload(null)
    setAction(null)
    setResult(null)
    setCameraError('')
    setManualCode('')
    setManualError('')
    setPlannedDuration(60)
    setSessionType('standard')
    setSignatureDataUrl('')
    setSignatureEmpty(true)
    setStartSetupError('')
    setScanAttempt((current) => current + 1)
    setStep('scanning')
  }

  return (
    <div className="page-enter">
      <div className="scan-page-header" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.25rem' }}>
        <Link href="/teacher/dashboard" style={{ color: '#64748b' }}>
          <ArrowLeft size={20} />
        </Link>
        <h1 style={{ fontSize: '1.25rem', fontWeight: 700 }}>Scanner le QR code</h1>
      </div>

      {/* STEP: Scanning */}
      {step === 'scanning' && (
        <div style={{ display: 'grid', gap: '1rem' }}>
          {cameraError && (
            <div className="card" style={{ textAlign: 'center', padding: '1.25rem' }}>
              <Camera size={40} color="#ef4444" style={{ margin: '0 auto 0.75rem' }} />
              <p style={{ color: '#ef4444', fontWeight: 600, marginBottom: '0.75rem' }}>
                {cameraError}
              </p>
              <p style={{ color: '#64748b', fontSize: '0.875rem', marginBottom: '1rem' }}>
                Vous pouvez quand même pointer avec le code manuel ci-dessous.
              </p>
              <button className="btn btn-secondary" onClick={() => setScanAttempt((current) => current + 1)}>
                Réessayer la caméra
              </button>
            </div>
          )}

          {!cameraError && (
            <div style={{ position: 'relative' }}>
              <div style={{
                borderRadius: 20,
                overflow: 'hidden',
                background: '#000',
                aspectRatio: '1',
              }}>
                <video
                  ref={videoRef}
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  playsInline
                  muted
                />
                <canvas ref={canvasRef} style={{ display: 'none' }} />
                {/* Scanner overlay */}
                <div style={{
                  position: 'absolute',
                  inset: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                  <div style={{
                    width: '65%',
                    aspectRatio: '1',
                    border: '3px solid rgba(255,255,255,0.6)',
                    borderRadius: 24,
                    boxShadow: '0 0 0 9999px rgba(0,0,0,0.4)',
                  }} />
                </div>
              </div>
              <p style={{
                textAlign: 'center',
                color: '#64748b',
                fontSize: '0.875rem',
                marginTop: '1rem',
              }}>
                Pointez votre caméra vers le QR code affiché dans le centre
              </p>
            </div>
          )}

          <div className="card" style={{ padding: '1.25rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.75rem' }}>
              <Keyboard size={18} color="#6366f1" />
              <strong>Entrer un code manuel</strong>
            </div>
            <p style={{ color: '#64748b', fontSize: '0.875rem', marginBottom: '1rem' }}>
              Saisissez le code manuel à 6 chiffres affiché avec le QR code.
            </p>
            <form onSubmit={handleManualCodeSubmit} className="scan-manual-form" style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
              <input
                className="input"
                inputMode="numeric"
                pattern="\d{6}"
                maxLength={6}
                placeholder="000000"
                value={manualCode}
                onChange={(e) => {
                  setManualCode(e.target.value.replace(/\D/g, '').slice(0, 6))
                  if (manualError) setManualError('')
                }}
                style={{ flex: 1, minWidth: 160, letterSpacing: '0.18rem', fontVariantNumeric: 'tabular-nums' }}
                required
              />
              <button className="btn btn-primary" type="submit" disabled={manualLoading || manualCode.length !== 6}>
                {manualLoading ? <><div className="spinner" /> Vérification...</> : 'Valider le code'}
              </button>
            </form>
            {manualError && (
              <p style={{ color: '#dc2626', fontSize: '0.82rem', marginTop: '0.75rem' }}>{manualError}</p>
            )}
          </div>
        </div>
      )}

      {/* STEP: Choose action */}
      {step === 'choose-action' && (
        <div className="card" style={{ textAlign: 'center' }}>
          <div style={{
            width: 64, height: 64, borderRadius: '50%',
            background: '#eef2ff',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 1rem',
          }}>
            <MapPin size={28} color="#6366f1" />
          </div>
          <h2 style={{ fontSize: '1.125rem', fontWeight: 700, marginBottom: '0.5rem' }}>
            QR code scanné ✓
          </h2>
          <p style={{ color: '#64748b', fontSize: '0.875rem', marginBottom: '1.5rem' }}>
            Que souhaitez-vous faire ?
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <button
              className="btn btn-success btn-lg"
              onClick={() => handleAction('start')}
            >
              <Play size={20} />
              Commencer le cours
            </button>
            <button
              className="btn btn-danger btn-lg"
              onClick={() => handleAction('end')}
            >
              <Square size={20} />
              Terminer le cours
            </button>
            <button className="btn btn-secondary" onClick={resetScan}>
              Scanner un autre QR code
            </button>
          </div>
        </div>
      )}

      {step === 'start-setup' && (
        <div className="scan-start-layout" style={{ display: 'grid', gap: '1rem' }}>
          <div className="card scan-start-card">
            <div className="scan-start-head" style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginBottom: '1rem' }}>
              <Clock3 size={20} color="#6366f1" />
              <div>
                <h2 className="scan-start-title" style={{ fontSize: '1.05rem', fontWeight: 700, color: '#1b2d5b' }}>Préparer le démarrage</h2>
                <p className="scan-start-copy" style={{ color: '#64748b', fontSize: '0.87rem', marginTop: '0.15rem' }}>
                  Choisissez la durée prévue, le type de séance puis signez avant de commencer.
                </p>
              </div>
            </div>

            <div className="scan-section" style={{ marginBottom: '1rem' }}>
              <div className="scan-section-title" style={{ fontWeight: 700, color: '#1b2d5b', marginBottom: '0.65rem' }}>Durée prévue</div>
              <div className="scan-option-grid scan-option-grid-three" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: '0.75rem' }}>
                {[
                  { value: 60 as const, label: '1h', hint: 'One-to-one ou courte séance' },
                  { value: 90 as const, label: '1h30', hint: 'Durée standard' },
                  { value: 120 as const, label: '2h', hint: 'Séance longue' },
                  { value: 180 as const, label: '3h', hint: 'Bloc intensif' },
                ].map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    className="btn scan-option-btn"
                    onClick={() => setPlannedDuration(option.value)}
                    style={{
                      border: plannedDuration === option.value ? '1px solid #6366f1' : '1px solid #e2e8f0',
                      background: plannedDuration === option.value ? '#eef2ff' : '#fff',
                      color: '#1b2d5b',
                      flexDirection: 'column',
                      alignItems: 'flex-start',
                      padding: '0.95rem 1rem',
                    }}
                  >
                    <span className="scan-option-label" style={{ fontSize: '1rem', fontWeight: 800 }}>{option.label}</span>
                    <span className="scan-option-hint" style={{ fontSize: '0.76rem', color: '#64748b', fontWeight: 500 }}>{option.hint}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="scan-section" style={{ marginBottom: '1rem' }}>
              <div className="scan-section-title" style={{ fontWeight: 700, color: '#1b2d5b', marginBottom: '0.65rem' }}>Type de séance</div>
              <div className="scan-option-grid scan-option-grid-two" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '0.75rem' }}>
                <button
                  type="button"
                  className="btn scan-option-btn"
                  onClick={() => setSessionType('standard')}
                  style={{
                    border: sessionType === 'standard' ? '1px solid #6366f1' : '1px solid #e2e8f0',
                    background: sessionType === 'standard' ? '#eef2ff' : '#fff',
                    color: '#1b2d5b',
                    flexDirection: 'column',
                    alignItems: 'flex-start',
                    padding: '0.95rem 1rem',
                  }}
                >
                  <span className="scan-option-label" style={{ fontSize: '0.98rem', fontWeight: 800 }}>Cours normal</span>
                  <span className="scan-option-hint" style={{ fontSize: '0.78rem', color: '#64748b' }}>Taux horaire normal</span>
                </button>
                <button
                  type="button"
                  className="btn scan-option-btn"
                  onClick={() => setSessionType('one_to_one')}
                  style={{
                    border: sessionType === 'one_to_one' ? '1px solid #6366f1' : '1px solid #e2e8f0',
                    background: sessionType === 'one_to_one' ? '#eef2ff' : '#fff',
                    color: '#1b2d5b',
                    flexDirection: 'column',
                    alignItems: 'flex-start',
                    padding: '0.95rem 1rem',
                  }}
                >
                  <span className="scan-option-label" style={{ fontSize: '0.98rem', fontWeight: 800 }}>One-to-one</span>
                  <span className="scan-option-hint" style={{ fontSize: '0.78rem', color: '#64748b' }}>Taux majoré × 1,5</span>
                </button>
              </div>
            </div>

            <div className="scan-signature-block">
              <div className="scan-signature-head" style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.75rem' }}>
                <PenTool size={18} color="#6366f1" />
                <div className="scan-section-title" style={{ fontWeight: 700, color: '#1b2d5b' }}>Signature du professeur</div>
              </div>
              <SignaturePad
                onChange={(value, isEmpty) => {
                  setSignatureDataUrl(value)
                  setSignatureEmpty(isEmpty)
                  if (!isEmpty && startSetupError) setStartSetupError('')
                }}
              />
            </div>

            {startSetupError ? (
              <div style={{ marginTop: '1rem', color: '#b91c1c', fontSize: '0.85rem' }}>{startSetupError}</div>
            ) : null}

            <div className="scan-start-actions" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '1rem' }}>
              <button className="btn btn-success btn-lg" onClick={handleStartSession}>
                <Play size={20} />
                Signer et commencer le cours
              </button>
              <button className="btn btn-secondary" onClick={() => setStep('choose-action')}>
                Retour
              </button>
            </div>
          </div>
        </div>
      )}

      {/* STEP: Processing */}
      {step === 'processing' && (
        <div className="card" style={{ textAlign: 'center', padding: '3rem 1.5rem' }}>
          <Loader2 size={48} color="#6366f1" style={{ margin: '0 auto 1rem', animation: 'spin 1s linear infinite' }} />
          <h2 style={{ fontSize: '1.125rem', fontWeight: 700, marginBottom: '0.5rem' }}>
            Vérification en cours...
          </h2>
          <p style={{ color: '#64748b', fontSize: '0.875rem' }}>
            {action === 'start' ? 'Démarrage de la session...' : 'Fin de session...'}
          </p>
        </div>
      )}

      {/* STEP: Result */}
      {step === 'result' && result && (
        <div className="card" style={{ textAlign: 'center' }}>
          <div style={{
            width: 72, height: 72, borderRadius: '50%',
            background: result.success ? '#d1fae5' : '#fee2e2',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 1rem',
          }}>
            {result.success ? (
              <CheckCircle size={36} color="#10b981" />
            ) : (
              <XCircle size={36} color="#ef4444" />
            )}
          </div>
          <h2 style={{
            fontSize: '1.125rem',
            fontWeight: 700,
            marginBottom: '0.5rem',
            color: result.success ? '#065f46' : '#991b1b',
          }}>
            {result.success ? 'Pointage accepté' : 'Pointage refusé'}
          </h2>
          <p style={{ color: '#64748b', fontSize: '0.875rem', marginBottom: '1.5rem' }}>
            {result.message}
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {result.success ? (
              <Link href="/teacher/dashboard" className="btn btn-primary btn-lg" style={{ textDecoration: 'none' }}>
                Retour au tableau de bord
              </Link>
            ) : (
              <>
                <button className="btn btn-primary btn-lg" onClick={resetScan}>
                  Réessayer
                </button>
                <Link href="/teacher/dashboard" className="btn btn-secondary" style={{ textDecoration: 'none' }}>
                  Retour
                </Link>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
