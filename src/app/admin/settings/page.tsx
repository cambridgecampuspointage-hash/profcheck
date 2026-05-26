'use client'

import { useState, useEffect } from 'react'
import { getAppSettings, getCenters, createCenter, updateAppSettings, updateCenter, listMcpTokens, generateMcpToken, revokeMcpToken, deleteMcpToken } from '@/lib/actions'
import type { AppSettings, Center } from '@/lib/types'
import type { McpToken } from '@/lib/actions'
import { Edit2, Settings as SettingsIcon, MapPin, Plus, X, Loader2, Key, Copy, Check, Power, Trash2 } from 'lucide-react'
import { LocationMap } from '@/components/ui/expand-map'

function formatCoordinates(latitude: number, longitude: number) {
  const latDirection = latitude >= 0 ? 'N' : 'S'
  const lngDirection = longitude >= 0 ? 'E' : 'W'

  return `${Math.abs(latitude).toFixed(4)}° ${latDirection}, ${Math.abs(longitude).toFixed(4)}° ${lngDirection}`
}

export default function SettingsPage() {
  const [centers, setCenters] = useState<Center[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingCenter, setEditingCenter] = useState<Center | null>(null)
  const [togglingCenterId, setTogglingCenterId] = useState<string | null>(null)
  const [appSettings, setAppSettings] = useState<AppSettings | null>(null)
  const [savingAppSettings, setSavingAppSettings] = useState(false)
  const [mcpTokens, setMcpTokens] = useState<McpToken[]>([])
  const [mcpLoading, setMcpLoading] = useState(true)
  const [mcpGenerating, setMcpGenerating] = useState(false)
  const [mcpNewToken, setMcpNewToken] = useState<string | null>(null)
  const [mcpCopied, setMcpCopied] = useState<string | null>(null)

  const fetchCenters = async () => {
    setLoading(true)
    const [centerData, settingsData] = await Promise.all([getCenters(), getAppSettings()])
    setCenters(centerData as Center[])
    setAppSettings(settingsData as AppSettings | null)
    setLoading(false)
  }

  const fetchMcpTokens = async () => {
    setMcpLoading(true)
    const tokens = await listMcpTokens()
    setMcpTokens(tokens)
    setMcpLoading(false)
  }

  useEffect(() => {
    let active = true

    async function loadCenters() {
      const [centerData, settingsData] = await Promise.all([getCenters(), getAppSettings()])
      if (!active) return
      setCenters(centerData as Center[])
      setAppSettings(settingsData as AppSettings | null)
      setLoading(false)
    }

    void loadCenters()
    void fetchMcpTokens()

    return () => {
      active = false
    }
  }, [])

  const handleMcpGenerate = async () => {
    setMcpGenerating(true)
    setMcpNewToken(null)
    const result = await generateMcpToken('default')
    setMcpGenerating(false)
    if (result.data) {
      setMcpNewToken(result.data.token)
      void fetchMcpTokens()
    }
  }

  const handleMcpRevoke = async (id: string) => {
    await revokeMcpToken(id)
    void fetchMcpTokens()
  }

  const handleMcpDelete = async (id: string) => {
    await deleteMcpToken(id)
    void fetchMcpTokens()
  }

  const mcpCopy = (value: string) => {
    navigator.clipboard.writeText(value)
    setMcpCopied(value)
    setTimeout(() => setMcpCopied(null), 2000)
  }

  const toggleGpsVerification = async (center: Center) => {
    setTogglingCenterId(center.id)
    const result = await updateCenter(center.id, {
      gps_verification_enabled: !center.gps_verification_enabled,
    })
    setTogglingCenterId(null)

    if (result.error) {
      window.alert(result.error)
      return
    }

    void fetchCenters()
  }

  const saveAppSettings = async (data: Partial<AppSettings>) => {
    setSavingAppSettings(true)
    const result = await updateAppSettings({
      auto_close_active_sessions: data.auto_close_active_sessions,
      auto_close_after_minutes: data.auto_close_after_minutes,
    })
    setSavingAppSettings(false)

    if (result.error) {
      window.alert(result.error)
      return
    }

    void fetchCenters()
  }

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
                <div style={{ marginBottom: '0.75rem', minHeight: '46px' }}>
                  <LocationMap
                    compact
                    location={center.address || center.name}
                    coordinates={formatCoordinates(center.latitude, center.longitude)}
                  />
                </div>
                <div style={{ display: 'flex', gap: '1.5rem', fontSize: '0.8125rem', color: '#94a3b8' }}>
                  <span>📍 {center.latitude?.toFixed(6)}, {center.longitude?.toFixed(6)}</span>
                  <span>📏 Rayon: {center.allowed_radius_meters}m</span>
                </div>
                <div style={{ marginTop: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '0.8125rem', color: center.gps_verification_enabled ? '#0f766e' : '#b45309', fontWeight: 700 }}>
                    GPS {center.gps_verification_enabled ? 'activé' : 'désactivé'}
                  </span>
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => toggleGpsVerification(center)}
                    disabled={togglingCenterId === center.id}
                  >
                    {togglingCenterId === center.id ? <><div className="spinner" /> Mise à jour...</> : center.gps_verification_enabled ? 'Désactiver le GPS' : 'Activer le GPS'}
                  </button>
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => {
                      setEditingCenter(center)
                      setShowModal(true)
                    }}
                  >
                    <Edit2 size={14} /> Modifier
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="card" style={{ marginBottom: '2rem' }}>
        <h2 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '0.75rem' }}>Clôture automatique des oublis</h2>
        <div style={{ display: 'grid', gap: '0.9rem' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', fontSize: '0.9rem', color: '#374151' }}>
            <input
              type="checkbox"
              checked={appSettings?.auto_close_active_sessions || false}
              onChange={(event) => {
                setAppSettings((current) => current ? { ...current, auto_close_active_sessions: event.target.checked } : current)
              }}
            />
            Activer la clôture automatique des sessions restées actives trop longtemps
          </label>

          <div style={{ maxWidth: 280 }}>
            <label style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>
              Délai avant clôture automatique (minutes)
            </label>
            <input
              className="input"
              type="number"
              min="30"
              step="15"
              value={appSettings?.auto_close_after_minutes ?? 360}
              onChange={(event) => {
                const nextValue = Number(event.target.value)
                setAppSettings((current) => current ? { ...current, auto_close_after_minutes: nextValue } : current)
              }}
            />
          </div>

          <div>
            <button
              className="btn btn-primary btn-sm"
              disabled={savingAppSettings || !appSettings}
              onClick={() => appSettings && void saveAppSettings(appSettings)}
            >
              {savingAppSettings ? <><div className="spinner" /> Enregistrement...</> : 'Enregistrer les réglages'}
            </button>
          </div>
        </div>
      </div>

      {/* MCP Tokens */}
      <div className="card" style={{ marginBottom: '2rem' }}>
        <h2 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '0.75rem' }}>
          <Key size={16} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 6 }} />
          Tokens MCP
        </h2>
        <p style={{ fontSize: '0.8125rem', color: '#64748b', marginBottom: '1rem' }}>
          Gérez vos tokens d&apos;accès pour connecter les assistants IA à ProfCheck.
        </p>

        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
          <button className="btn btn-primary btn-sm" onClick={handleMcpGenerate} disabled={mcpGenerating}>
            {mcpGenerating ? 'Génération...' : 'Générer un token'}
          </button>
          <a href="/mcp" className="btn btn-secondary btn-sm" style={{ textDecoration: 'none' }}>
            Comment configurer
          </a>
        </div>

        {mcpNewToken && (
          <div style={{ background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: 10, padding: '0.75rem', marginBottom: '1rem' }}>
            <p style={{ fontSize: '0.75rem', fontWeight: 700, color: '#065f46', marginBottom: '0.5rem' }}>
              Nouveau token — copiez-le maintenant, il ne sera plus jamais affiché
            </p>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <code style={{ flex: 1, background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, padding: '0.5rem 0.75rem', fontSize: '0.75rem', fontFamily: 'monospace', wordBreak: 'break-all' }}>
                {mcpNewToken}
              </code>
              <button className="btn btn-sm btn-secondary" onClick={() => mcpCopy(mcpNewToken)}>
                {mcpCopied === mcpNewToken ? <Check size={14} /> : <Copy size={14} />}
              </button>
            </div>
          </div>
        )}

        {mcpLoading ? (
          <div style={{ textAlign: 'center', padding: '1rem', color: '#94a3b8', fontSize: '0.875rem' }}>Chargement...</div>
        ) : mcpTokens.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '1rem', color: '#94a3b8', fontSize: '0.875rem' }}>
            Aucun token. Créez-en un pour connecter vos outils IA.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {mcpTokens.map((t) => (
              <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem', background: '#f8fafc', borderRadius: 10 }}>
                <Key size={18} style={{ color: t.is_active ? '#0f766e' : '#94a3b8', flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ fontWeight: 700, fontSize: '0.875rem' }}>{t.name}</span>
                    {t.is_active ? (
                      <span style={{ fontSize: '0.6875rem', fontWeight: 700, color: '#0f766e', background: '#d1fae5', padding: '0.125rem 0.5rem', borderRadius: 999 }}>Actif</span>
                    ) : (
                      <span style={{ fontSize: '0.6875rem', fontWeight: 700, color: '#64748b', background: '#f1f5f9', padding: '0.125rem 0.5rem', borderRadius: 999 }}>Révoqué</span>
                    )}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '0.125rem' }}>
                    Créé le {new Date(t.created_at).toLocaleDateString('fr-FR')}
                    {t.last_used_at && ` · Dernière utilisation : ${new Date(t.last_used_at).toLocaleDateString('fr-FR')}`}
                  </div>
                </div>
                <button className="btn btn-sm btn-secondary" onClick={() => mcpCopy(t.token)} title="Copier">
                  {mcpCopied === t.token ? <Check size={14} /> : <Copy size={14} />}
                </button>
                {t.is_active && (
                  <button className="btn btn-sm" onClick={() => handleMcpRevoke(t.id)} style={{ background: 'rgba(245,158,11,0.1)', color: '#92400e', border: '1px solid rgba(245,158,11,0.2)' }} title="Révoquer">
                    <Power size={14} />
                  </button>
                )}
                <button className="btn btn-sm" onClick={() => handleMcpDelete(t.id)} style={{ background: 'rgba(239,68,68,0.08)', color: '#991b1b', border: '1px solid rgba(239,68,68,0.15)' }} title="Supprimer">
                  <Trash2 size={14} />
                </button>
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
          center={editingCenter}
          onClose={() => setShowModal(false)}
          onSaved={() => {
            setShowModal(false)
            setEditingCenter(null)
            void fetchCenters()
          }}
        />
      )}
    </div>
  )
}

function CenterModalInline({ center, onClose, onSaved }: { center?: Center | null; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState(center?.name || '')
  const [address, setAddress] = useState(center?.address || '')
  const [latitude, setLatitude] = useState(center ? String(center.latitude) : '')
  const [longitude, setLongitude] = useState(center ? String(center.longitude) : '')
  const [radius, setRadius] = useState(center ? String(center.allowed_radius_meters) : '80')
  const [gpsVerificationEnabled, setGpsVerificationEnabled] = useState(center?.gps_verification_enabled ?? true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError('')
    const payload = {
      name,
      address,
      latitude: Number(latitude),
      longitude: Number(longitude),
      allowed_radius_meters: Number(radius),
      gps_verification_enabled: gpsVerificationEnabled,
    }
    const res = center
      ? await updateCenter(center.id, payload)
      : await createCenter(payload)
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
          <h2 style={{ fontSize: '1.125rem', fontWeight: 700 }}>{center ? 'Modifier le centre' : 'Ajouter un centre'}</h2>
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
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', fontSize: '0.875rem', color: '#374151' }}>
            <input
              type="checkbox"
              checked={gpsVerificationEnabled}
              onChange={(e) => setGpsVerificationEnabled(e.target.checked)}
            />
            Activer la vérification GPS pour ce centre
          </label>
          <button className="btn btn-primary" type="submit" disabled={saving} style={{ width: '100%' }}>
            {saving ? <><div className="spinner" /> Enregistrement...</> : center ? 'Mettre à jour le centre' : 'Créer le centre'}
          </button>
        </form>
      </div>
    </div>
  )
}
