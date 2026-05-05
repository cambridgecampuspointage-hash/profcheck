'use client'

import { useState, useEffect, useCallback, use } from 'react'
import { generateQrToken } from '@/lib/actions'
import { QRCodeSVG } from 'qrcode.react'
import { Loader2, RefreshCw, AlertCircle } from 'lucide-react'
import type { QrPayload } from '@/lib/types'

export default function QrDisplayPage({ params }: { params: Promise<{ roomId: string }> }) {
  const { roomId } = use(params)
  const [qrData, setQrData] = useState('')
  const [manualCode, setManualCode] = useState('')
  const [countdown, setCountdown] = useState(60)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  const fetchToken = useCallback(async () => {
    setLoading(true)
    setError('')
    const result = await generateQrToken(roomId)
    if (result.error) {
      setError(result.error)
      setLoading(false)
      return
    }
    if (result.data) {
      setQrData(JSON.stringify(result.data))
      setManualCode(result.data.access_code || '')
      setCountdown(60)
    }
    setLoading(false)
  }, [roomId])

  useEffect(() => {
    let active = true

    async function loadToken() {
      const result = await generateQrToken(roomId)
      if (!active) return

      setError(result.error || '')
      if (result.data) {
        setQrData(JSON.stringify(result.data))
        setManualCode(result.data.access_code || '')
        setCountdown(60)
      }
      setLoading(false)
    }

    void loadToken()

    return () => {
      active = false
    }
  }, [roomId])

  const parsedPayload = qrData ? (JSON.parse(qrData) as QrPayload) : null

  // Auto-refresh every 60 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      void fetchToken()
    }, 60000)
    return () => clearInterval(interval)
  }, [fetchToken])

  // Countdown timer
  useEffect(() => {
    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) return 60
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(interval)
  }, [])

  if (error) {
    return (
      <div className="qr-display-page">
        <div style={{ textAlign: 'center' }}>
          <AlertCircle size={64} color="#ef4444" style={{ marginBottom: '1.5rem' }} />
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '0.5rem' }}>Erreur</h1>
          <p style={{ color: '#94a3b8', marginBottom: '1.5rem' }}>{error}</p>
          <button className="btn btn-primary btn-lg" onClick={fetchToken}>
            <RefreshCw size={18} /> Réessayer
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="qr-display-page">
      {/* Logo */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '2rem' }}>
        <div style={{
          width: 12, height: 12, borderRadius: '50%',
          background: '#6366f1',
        }} />
        <span style={{ fontSize: '1.5rem', fontWeight: 800, letterSpacing: '-0.02em' }}>
          ProfCheck
        </span>
      </div>

      {loading && !qrData ? (
        <Loader2 size={64} style={{ animation: 'spin 1s linear infinite', color: '#6366f1' }} />
      ) : (
        <>
          {/* QR code */}
          <div style={{
            background: 'white',
            borderRadius: 24,
            padding: '2rem',
            boxShadow: '0 25px 60px rgba(0,0,0,0.3)',
            marginBottom: '2rem',
          }}>
            <QRCodeSVG
              value={qrData}
              size={300}
              level="H"
              includeMargin
              style={{ display: 'block' }}
            />
          </div>

          <div style={{
            background: 'rgba(255,255,255,0.92)',
            borderRadius: 20,
            padding: '1.5rem',
            minWidth: 300,
            marginBottom: '1.5rem',
            textAlign: 'center',
            boxShadow: '0 18px 40px rgba(0,0,0,0.16)',
          }}>
            <p style={{ color: '#64748b', fontSize: '0.9rem', marginBottom: '0.45rem' }}>
              Code manuel de secours
            </p>
            <div style={{
              fontSize: '2.8rem',
              fontWeight: 800,
              letterSpacing: '0.3rem',
              color: '#1b2d5b',
              fontVariantNumeric: 'tabular-nums',
              marginBottom: '0.45rem',
            }}>
              {manualCode || parsedPayload?.access_code || '------'}
            </div>
            <p style={{ color: '#94a3b8', fontSize: '0.82rem' }}>
              Le professeur peut saisir ce code si la caméra ne fonctionne pas.
            </p>
          </div>

          {/* Countdown */}
          <div style={{ textAlign: 'center' }}>
            <p style={{ fontSize: '1.125rem', color: '#94a3b8', marginBottom: '0.5rem' }}>
              QR code valable encore
            </p>
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
              background: countdown <= 10 ? 'rgba(239, 68, 68, 0.2)' : 'rgba(99, 102, 241, 0.2)',
              padding: '0.75rem 1.5rem',
              borderRadius: 12,
              transition: 'background 0.3s',
            }}>
              <span style={{
                fontSize: '2rem',
                fontWeight: 800,
                fontVariantNumeric: 'tabular-nums',
                color: countdown <= 10 ? '#ef4444' : '#a5b4fc',
              }}>
                {countdown}
              </span>
              <span style={{ fontSize: '1rem', color: '#94a3b8' }}>secondes</span>
            </div>
          </div>

          <p style={{
            color: '#475569',
            fontSize: '0.875rem',
            marginTop: '2rem',
            textAlign: 'center',
            maxWidth: 400,
          }}>
            Scannez ce QR code avec l&apos;application ProfCheck sur votre téléphone pour pointer votre présence.
          </p>
        </>
      )}
    </div>
  )
}
