'use client'

import { useState, useEffect } from 'react'
import { getCenters, createCenter } from '@/lib/actions'
import type { Center } from '@/lib/types'
import { Settings as SettingsIcon, MapPin, Plus, X, Loader2 } from 'lucide-react'

export default function SettingsPage() {
  const [centers, setCenters] = useState<Center[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)

  const fetchCenters = async () => {
    setLoading(true)
    const data = await getCenters()
    setCenters(data as Center[])
    setLoading(false)
  }

  useEffect(() => {
    let active = true

    async function loadCenters() {
      const data = await getCenters()
      if (!active) return
      setCenters(data as Center[])
      setLoading(false)
    }

    void loadCenters()

    return () => {
      active = false
    }
  }, [])

  return (
    <div>
      <h1 style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: '1.5rem' }}>
        <SettingsIcon size={22} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 8 }} />
        Paramètres
      </h1>

      {/* Centers */}
      <div style={{ marginBottom: '2rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h2 style={{ fontSize: '1.125rem', fontWeight: 700 }}>
            <MapPin size={16} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 6 }} />
            Centres de langues
          </h2>
          <button className="btn btn-primary btn-sm" onClick={() => setShowModal(true)}>
            <Plus size={14} /> Ajouter
          </button>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '2rem' }}>
            <Loader2 size={24} style={{ animation: 'spin 1s linear infinite', color: '#6366f1' }} />
          </div>
        ) : centers.length === 0 ? (
          <div className="card" style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>
            Aucun centre configuré. Ajoutez un centre pour commencer.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {centers.map((center) => (
              <div key={center.id} className="card">
                <p style={{ fontWeight: 700, fontSize: '1rem', marginBottom: '0.25rem' }}>{center.name}</p>
                <p style={{ color: '#64748b', fontSize: '0.8125rem', marginBottom: '0.5rem' }}>{center.address || 'Adresse non renseignée'}</p>
                <div style={{ display: 'flex', gap: '1.5rem', fontSize: '0.8125rem', color: '#94a3b8' }}>
                  <span>📍 {center.latitude?.toFixed(6)}, {center.longitude?.toFixed(6)}</span>
                  <span>📏 Rayon: {center.allowed_radius_meters}m</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* App Info */}
      <div className="card" style={{ background: '#f8fafc' }}>
        <h2 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '0.75rem' }}>À propos</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem', fontSize: '0.875rem', color: '#64748b' }}>
          <p><strong>ProfCheck</strong> v1.0</p>
          <p>Système de pointage intelligent pour centres de langues</p>
          <p>© {new Date().getFullYear()} Tous droits réservés</p>
        </div>
      </div>

      {showModal && (
        <CenterModalInline
          onClose={() => setShowModal(false)}
          onSaved={() => {
            setShowModal(false)
            void fetchCenters()
          }}
        />
      )}
    </div>
  )
}

function CenterModalInline({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState('')
  const [address, setAddress] = useState('')
  const [latitude, setLatitude] = useState('')
  const [longitude, setLongitude] = useState('')
  const [radius, setRadius] = useState('80')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError('')
    const res = await createCenter({
      name, address,
      latitude: Number(latitude),
      longitude: Number(longitude),
      allowed_radius_meters: Number(radius),
    })
    if (res.error) { setError(res.error); setSaving(false); return }
    onSaved()
  }

  const getCurrentLocation = () => {
    navigator.geolocation.getCurrentPosition(
      (pos) => { setLatitude(String(pos.coords.latitude)); setLongitude(String(pos.coords.longitude)) },
      () => setError('Impossible d\'obtenir la position.')
    )
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
          <h2 style={{ fontSize: '1.125rem', fontWeight: 700 }}>Ajouter un centre</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}><X size={20} /></button>
        </div>
        {error && <div style={{ background: '#fee2e2', color: '#dc2626', padding: '0.75rem', borderRadius: 10, fontSize: '0.875rem', marginBottom: '1rem' }}>{error}</div>}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div>
            <label style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>Nom *</label>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div>
            <label style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>Adresse</label>
            <input className="input" value={address} onChange={(e) => setAddress(e.target.value)} />
          </div>
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>Latitude *</label>
              <input className="input" type="number" step="any" value={latitude} onChange={(e) => setLatitude(e.target.value)} required />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>Longitude *</label>
              <input className="input" type="number" step="any" value={longitude} onChange={(e) => setLongitude(e.target.value)} required />
            </div>
          </div>
          <button type="button" className="btn btn-secondary btn-sm" onClick={getCurrentLocation}>📍 Utiliser ma position</button>
          <div>
            <label style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>Rayon (mètres)</label>
            <input className="input" type="number" value={radius} onChange={(e) => setRadius(e.target.value)} />
          </div>
          <button className="btn btn-primary" type="submit" disabled={saving} style={{ width: '100%' }}>
            {saving ? <><div className="spinner" /> Enregistrement...</> : 'Créer le centre'}
          </button>
        </form>
      </div>
    </div>
  )
}
