'use client'

import { useEffect, useState } from 'react'
import { getTeacherStats } from '@/lib/actions'
import type { AttendanceSession } from '@/lib/types'
import { Clock, MapPin, QrCode } from 'lucide-react'
import Link from 'next/link'

export default function CurrentSessionPage() {
  const [session, setSession] = useState<AttendanceSession | null>(null)
  const [loading, setLoading] = useState(true)
  const [elapsed, setElapsed] = useState('')

  useEffect(() => {
    const fetchSession = async () => {
      const stats = await getTeacherStats()
      setSession(stats?.activeSession || null)
      setLoading(false)
    }
    fetchSession()
  }, [])

  useEffect(() => {
    if (!session) return
    const interval = setInterval(() => {
      const start = new Date(session.started_at).getTime()
      const now = Date.now()
      const diff = now - start
      const hours = Math.floor(diff / 3600000)
      const minutes = Math.floor((diff % 3600000) / 60000)
      const seconds = Math.floor((diff % 60000) / 1000)
      setElapsed(
        `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
      )
    }, 1000)
    return () => clearInterval(interval)
  }, [session])

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '3rem 1rem' }}>
        <div className="spinner spinner-dark" style={{ margin: '0 auto 1rem', width: 32, height: 32 }} />
        <p style={{ color: '#64748b' }}>Chargement...</p>
      </div>
    )
  }

  if (!session) {
    return (
      <div className="page-enter">
        <h1 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '1.25rem' }}>
          Session en cours
        </h1>
        <div className="card" style={{ textAlign: 'center', padding: '2.5rem 1.5rem' }}>
          <div style={{
            width: 64, height: 64, borderRadius: '50%',
            background: '#f1f5f9',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 1rem',
          }}>
            <Clock size={28} color="#94a3b8" />
          </div>
          <h2 style={{ fontSize: '1rem', fontWeight: 600, color: '#374151', marginBottom: '0.5rem' }}>
            Aucune session active
          </h2>
          <p style={{ color: '#64748b', fontSize: '0.875rem', marginBottom: '1.5rem' }}>
            Scannez le QR code pour commencer un cours.
          </p>
          <Link href="/teacher/scan" className="btn btn-primary" style={{ textDecoration: 'none' }}>
            <QrCode size={18} />
            Scanner le QR code
          </Link>
        </div>
      </div>
    )
  }

  const roomName = (session.room as unknown as { name: string })?.name || 'Salle inconnue'
  const startTime = new Date(session.started_at).toLocaleTimeString('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
  })

  return (
    <div className="page-enter">
      <h1 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '1.25rem' }}>
        Session en cours
      </h1>

      <div style={{
        background: 'linear-gradient(135deg, #10b981 0%, #34d399 100%)',
        borderRadius: 20,
        padding: '2rem 1.5rem',
        color: 'white',
        textAlign: 'center',
        marginBottom: '1.25rem',
      }}>
        <div style={{
          width: 56, height: 56, borderRadius: '50%',
          background: 'rgba(255,255,255,0.2)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 1rem',
        }}>
          <Clock size={28} />
        </div>
        <p style={{ fontSize: '2.5rem', fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>
          {elapsed || '00:00:00'}
        </p>
        <p style={{ fontSize: '0.875rem', opacity: 0.9, marginTop: '0.5rem' }}>
          Temps écoulé
        </p>
      </div>

      <div className="card" style={{ marginBottom: '1.25rem' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: '#64748b', fontSize: '0.875rem' }}>Salle</span>
            <span style={{ fontWeight: 600 }}>{roomName}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: '#64748b', fontSize: '0.875rem' }}>Début</span>
            <span style={{ fontWeight: 600 }}>{startTime}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: '#64748b', fontSize: '0.875rem' }}>Statut</span>
            <span className="badge badge-active">En cours</span>
          </div>
          {session.start_latitude && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: '#64748b', fontSize: '0.875rem' }}>GPS</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#10b981', fontSize: '0.8125rem' }}>
                <MapPin size={14} /> Vérifié
              </span>
            </div>
          )}
        </div>
      </div>

      <Link href="/teacher/scan" className="btn btn-danger btn-lg" style={{ textDecoration: 'none', width: '100%' }}>
        <QrCode size={20} />
        Scanner pour terminer le cours
      </Link>
    </div>
  )
}
