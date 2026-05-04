'use client'

import { useState, useEffect } from 'react'
import { getRooms, getCenters, createRoom, updateRoom, createCenter } from '@/lib/actions'
import type { Room, Center } from '@/lib/types'
import { Plus, Edit2, QrCode, X, Loader2, Building2 } from 'lucide-react'
import Link from 'next/link'

export default function RoomsPage() {
  const [rooms, setRooms] = useState<(Room & { center?: Center })[]>([])
  const [centers, setCenters] = useState<Center[]>([])
  const [loading, setLoading] = useState(true)
  const [showRoomModal, setShowRoomModal] = useState(false)
  const [showCenterModal, setShowCenterModal] = useState(false)
  const [editingRoom, setEditingRoom] = useState<Room | null>(null)

  const fetchData = async () => {
    setLoading(true)
    const [roomData, centerData] = await Promise.all([getRooms(), getCenters()])
    setRooms(roomData as (Room & { center?: Center })[])
    setCenters(centerData as Center[])
    setLoading(false)
  }

  useEffect(() => {
    let active = true

    async function loadData() {
      const [roomData, centerData] = await Promise.all([getRooms(), getCenters()])
      if (!active) return
      setRooms(roomData as (Room & { center?: Center })[])
      setCenters(centerData as Center[])
      setLoading(false)
    }

    void loadData()

    return () => {
      active = false
    }
  }, [])

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '0.75rem' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 800 }}>Salles</h1>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button className="btn btn-secondary" onClick={() => setShowCenterModal(true)}>
            <Building2 size={16} />
            Ajouter un centre
          </button>
          <button className="btn btn-primary" onClick={() => { setEditingRoom(null); setShowRoomModal(true) }}>
            <Plus size={18} />
            Ajouter une salle
          </button>
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem' }}>
          <Loader2 size={32} style={{ margin: '0 auto', animation: 'spin 1s linear infinite', color: '#6366f1' }} />
        </div>
      ) : rooms.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '2.5rem', color: '#64748b' }}>
          {centers.length === 0 ? 'Créez d\'abord un centre, puis ajoutez des salles.' : 'Aucune salle créée.'}
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem' }}>
          {rooms.map((room) => (
            <div key={room.id} className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '0.75rem' }}>
                <div>
                  <p style={{ fontWeight: 700, fontSize: '1rem' }}>{room.name}</p>
                  <p style={{ color: '#64748b', fontSize: '0.8125rem' }}>
                    {(room.center as Center)?.name || 'Centre inconnu'}
                  </p>
                </div>
                <span className={`badge ${room.status === 'active' ? 'badge-active' : 'badge-rejected'}`}>
                  {room.status === 'active' ? 'Active' : 'Inactive'}
                </span>
              </div>
              {room.description && (
                <p style={{ color: '#94a3b8', fontSize: '0.8125rem', marginBottom: '0.75rem' }}>{room.description}</p>
              )}
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => { setEditingRoom(room); setShowRoomModal(true) }}
                >
                  <Edit2 size={14} /> Modifier
                </button>
                <Link href={`/admin/qr-display/${room.id}`} className="btn btn-primary btn-sm" style={{ textDecoration: 'none' }}>
                  <QrCode size={14} /> Afficher QR
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}

      {showRoomModal && (
        <RoomModal
          room={editingRoom}
          centers={centers}
          onClose={() => setShowRoomModal(false)}
          onSaved={() => {
            setShowRoomModal(false)
            void fetchData()
          }}
        />
      )}

      {showCenterModal && (
        <CenterModal
          onClose={() => setShowCenterModal(false)}
          onSaved={() => {
            setShowCenterModal(false)
            void fetchData()
          }}
        />
      )}
    </div>
  )
}

function RoomModal({ room, centers, onClose, onSaved }: {
  room: Room | null
  centers: Center[]
  onClose: () => void
  onSaved: () => void
}) {
  const [name, setName] = useState(room?.name || '')
  const [description, setDescription] = useState(room?.description || '')
  const [centerId, setCenterId] = useState(room?.center_id || centers[0]?.id || '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError('')

    if (room) {
      const res = await updateRoom(room.id, { name, description })
      if (res.error) { setError(res.error); setSaving(false); return }
    } else {
      const res = await createRoom({ center_id: centerId, name, description })
      if (res.error) { setError(res.error); setSaving(false); return }
    }
    onSaved()
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
          <h2 style={{ fontSize: '1.125rem', fontWeight: 700 }}>
            {room ? 'Modifier la salle' : 'Ajouter une salle'}
          </h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}><X size={20} /></button>
        </div>
        {error && <div style={{ background: '#fee2e2', color: '#dc2626', padding: '0.75rem', borderRadius: 10, fontSize: '0.875rem', marginBottom: '1rem' }}>{error}</div>}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {!room && (
            <div>
              <label style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>Centre *</label>
              <select className="input" value={centerId} onChange={(e) => setCenterId(e.target.value)} required>
                {centers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          )}
          <div>
            <label style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>Nom de la salle *</label>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div>
            <label style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>Description</label>
            <input className="input" value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <button className="btn btn-primary" type="submit" disabled={saving} style={{ width: '100%' }}>
            {saving ? <><div className="spinner" /> Enregistrement...</> : room ? 'Mettre à jour' : 'Créer la salle'}
          </button>
        </form>
      </div>
    </div>
  )
}

function CenterModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
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
      name,
      address,
      latitude: Number(latitude),
      longitude: Number(longitude),
      allowed_radius_meters: Number(radius),
    })
    if (res.error) { setError(res.error); setSaving(false); return }
    onSaved()
  }

  const getCurrentLocation = () => {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLatitude(String(pos.coords.latitude))
        setLongitude(String(pos.coords.longitude))
      },
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
            <label style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>Nom du centre *</label>
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
          <button type="button" className="btn btn-secondary btn-sm" onClick={getCurrentLocation}>
            📍 Utiliser ma position actuelle
          </button>
          <div>
            <label style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>Rayon autorisé (mètres)</label>
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
