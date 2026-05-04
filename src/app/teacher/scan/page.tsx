'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { BrowserQRCodeReader } from '@zxing/browser'
import { validateAttendanceScan } from '@/lib/actions'
import { getCurrentPosition, getGeoErrorMessage } from '@/lib/gps'
import type { QrPayload } from '@/lib/types'
import {
  Camera,
  MapPin,
  CheckCircle,
  XCircle,
  Loader2,
  Play,
  Square,
  ArrowLeft,
} from 'lucide-react'
import Link from 'next/link'

type ScanStep = 'scanning' | 'choose-action' | 'processing' | 'result'

export default function ScanPage() {
  const [step, setStep] = useState<ScanStep>('scanning')
  const [qrPayload, setQrPayload] = useState<QrPayload | null>(null)
  const [action, setAction] = useState<'start' | 'end' | null>(null)
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null)
  const [cameraError, setCameraError] = useState('')
  const [scanAttempt, setScanAttempt] = useState(0)
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
        position.coords.longitude
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

  const resetScan = () => {
    stopCamera()
    setQrPayload(null)
    setAction(null)
    setResult(null)
    setCameraError('')
    setScanAttempt((current) => current + 1)
    setStep('scanning')
  }

  return (
    <div className="page-enter">
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.25rem' }}>
        <Link href="/teacher/dashboard" style={{ color: '#64748b' }}>
          <ArrowLeft size={20} />
        </Link>
        <h1 style={{ fontSize: '1.25rem', fontWeight: 700 }}>Scanner le QR code</h1>
      </div>

      {/* STEP: Scanning */}
      {step === 'scanning' && (
        <div>
          {cameraError ? (
            <div className="card" style={{ textAlign: 'center', padding: '2rem' }}>
              <Camera size={48} color="#ef4444" style={{ margin: '0 auto 1rem' }} />
              <p style={{ color: '#ef4444', fontWeight: 600, marginBottom: '0.5rem' }}>
                {cameraError}
              </p>
              <button className="btn btn-primary" onClick={() => setScanAttempt((current) => current + 1)}>
                Réessayer
              </button>
            </div>
          ) : (
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
