'use client'

import { useEffect, useState } from 'react'
import {
  createReceptionUser,
  createTeacher,
  getReceptionUsers,
  getTeachers,
  updateReceptionUser,
  updateTeacher,
} from '@/lib/actions'
import type { ReceptionUser, Teacher } from '@/lib/types'
import { Edit2, Loader2, Plus, ShieldCheck, UserCheck, UserX, X } from 'lucide-react'

export default function TeachersPage() {
  const [teachers, setTeachers] = useState<Teacher[]>([])
  const [receptionUsers, setReceptionUsers] = useState<ReceptionUser[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingTeacher, setEditingTeacher] = useState<Teacher | null>(null)
  const [editingReception, setEditingReception] = useState<ReceptionUser | null>(null)
  const [modalRole, setModalRole] = useState<'teacher' | 'reception'>('teacher')

  const fetchData = async () => {
    setLoading(true)
    const [teacherData, receptionData] = await Promise.all([getTeachers(), getReceptionUsers()])
    setTeachers(teacherData as Teacher[])
    setReceptionUsers(receptionData as ReceptionUser[])
    setLoading(false)
  }

  useEffect(() => {
    let active = true

    async function loadData() {
      const [teacherData, receptionData] = await Promise.all([getTeachers(), getReceptionUsers()])
      if (!active) return
      setTeachers(teacherData as Teacher[])
      setReceptionUsers(receptionData as ReceptionUser[])
      setLoading(false)
    }

    void loadData()

    return () => {
      active = false
    }
  }, [])

  const handleToggleStatus = async (teacher: Teacher) => {
    const newStatus = teacher.status === 'active' ? 'inactive' : 'active'
    await updateTeacher(teacher.id, { status: newStatus })
    void fetchData()
  }

  const handleToggleReceptionStatus = async (profile: ReceptionUser) => {
    const newStatus = profile.status === 'active' ? 'inactive' : 'active'
    await updateReceptionUser(profile.id, { status: newStatus })
    void fetchData()
  }

  return (
    <div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-end',
          gap: '1rem',
          marginBottom: '1.25rem',
          flexWrap: 'wrap',
        }}
      >
        <div className="brand-page-header" style={{ marginBottom: 0 }}>
          <h1 className="brand-page-title">Équipe</h1>
          <p className="brand-page-subtitle">
            Gère les professeurs et les réceptionnistes depuis un espace unique.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <button
            className="brand-staff-btn brand-staff-btn-secondary"
            onClick={() => {
              setEditingTeacher(null)
              setEditingReception(null)
              setModalRole('reception')
              setShowModal(true)
            }}
          >
            <ShieldCheck size={18} />
            Ajouter un réceptionniste
          </button>
          <button
            className="brand-staff-btn brand-staff-btn-primary"
            onClick={() => {
              setEditingTeacher(null)
              setEditingReception(null)
              setModalRole('teacher')
              setShowModal(true)
            }}
          >
            <Plus size={18} />
            Ajouter un professeur
          </button>
        </div>
      </div>

      {loading ? (
        <div className="brand-card brand-card-pad" style={{ textAlign: 'center', padding: '3rem' }}>
          <Loader2 size={28} style={{ margin: '0 auto', color: 'var(--brand-gold)', animation: 'spin 1s linear infinite' }} />
        </div>
      ) : (
        <div style={{ display: 'grid', gap: '1rem' }}>
          <section className="brand-card">
            <div className="brand-panel-header">
              <span className="brand-panel-title">Professeurs</span>
              <span className="brand-panel-action">{teachers.length} profil(s)</span>
            </div>
            {teachers.length === 0 ? (
              <div className="brand-empty">Aucun professeur enregistré.</div>
            ) : (
              <div className="brand-staff-table-wrap">
                <table className="brand-staff-table">
                  <thead>
                    <tr>
                      <th>Nom</th>
                      <th>Email</th>
                      <th>Téléphone</th>
                      <th>Langues</th>
                      <th>Taux horaire</th>
                      <th>Statut</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {teachers.map((teacher) => (
                      <tr key={teacher.id}>
                        <td className="brand-staff-strong">{teacher.full_name}</td>
                        <td>{teacher.email || '-'}</td>
                        <td>{teacher.phone || '-'}</td>
                        <td>{teacher.languages?.join(', ') || '-'}</td>
                        <td>{teacher.hourly_rate}€/h</td>
                        <td>
                          <span className={`brand-badge ${teacher.status === 'active' ? 'success' : 'danger'}`}>
                            {teacher.status === 'active' ? 'Actif' : 'Inactif'}
                          </span>
                        </td>
                        <td>
                          <div className="brand-staff-actions">
                            <button
                              className="brand-staff-icon-btn"
                              onClick={() => {
                                setEditingTeacher(teacher)
                                setEditingReception(null)
                                setModalRole('teacher')
                                setShowModal(true)
                              }}
                            >
                              <Edit2 size={15} />
                            </button>
                            <button
                              className={`brand-staff-icon-btn ${teacher.status === 'active' ? 'danger' : 'success'}`}
                              onClick={() => handleToggleStatus(teacher)}
                            >
                              {teacher.status === 'active' ? <UserX size={15} /> : <UserCheck size={15} />}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="brand-card">
            <div className="brand-panel-header">
              <span className="brand-panel-title">Réception</span>
              <span className="brand-panel-action">{receptionUsers.length} profil(s)</span>
            </div>
            {receptionUsers.length === 0 ? (
              <div className="brand-empty">Aucun réceptionniste enregistré.</div>
            ) : (
              <div className="brand-staff-table-wrap">
                <table className="brand-staff-table">
                  <thead>
                    <tr>
                      <th>Nom</th>
                      <th>Email</th>
                      <th>Téléphone</th>
                      <th>Statut</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {receptionUsers.map((profile) => (
                      <tr key={profile.id}>
                        <td className="brand-staff-strong">{profile.full_name || '-'}</td>
                        <td>{profile.email || '-'}</td>
                        <td>{profile.phone || '-'}</td>
                        <td>
                          <span className={`brand-badge ${profile.status === 'active' ? 'success' : 'danger'}`}>
                            {profile.status === 'active' ? 'Actif' : 'Inactif'}
                          </span>
                        </td>
                        <td>
                          <div className="brand-staff-actions">
                            <button
                              className="brand-staff-icon-btn"
                              onClick={() => {
                                setEditingReception(profile)
                                setEditingTeacher(null)
                                setModalRole('reception')
                                setShowModal(true)
                              }}
                            >
                              <Edit2 size={15} />
                            </button>
                            <button
                              className={`brand-staff-icon-btn ${profile.status === 'active' ? 'danger' : 'success'}`}
                              onClick={() => handleToggleReceptionStatus(profile)}
                            >
                              {profile.status === 'active' ? <UserX size={15} /> : <UserCheck size={15} />}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      )}

      {showModal && (
        <StaffModal
          role={modalRole}
          teacher={editingTeacher}
          receptionUser={editingReception}
          onClose={() => setShowModal(false)}
          onSaved={() => {
            setShowModal(false)
            void fetchData()
          }}
        />
      )}
    </div>
  )
}

function StaffModal({
  role,
  teacher,
  receptionUser,
  onClose,
  onSaved,
}: {
  role: 'teacher' | 'reception'
  teacher: Teacher | null
  receptionUser: ReceptionUser | null
  onClose: () => void
  onSaved: () => void
}) {
  const isTeacher = role === 'teacher'
  const [fullName, setFullName] = useState(teacher?.full_name || receptionUser?.full_name || '')
  const [email, setEmail] = useState(teacher?.email || receptionUser?.email || '')
  const [phone, setPhone] = useState(teacher?.phone || receptionUser?.phone || '')
  const [languages, setLanguages] = useState(teacher?.languages?.join(', ') || '')
  const [hourlyRate, setHourlyRate] = useState(String(teacher?.hourly_rate || ''))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [tempPassword, setTempPassword] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError('')

    const langArray = languages.split(',').map((value) => value.trim()).filter(Boolean)

    if (teacher) {
      const res = await updateTeacher(teacher.id, {
        full_name: fullName,
        phone,
        languages: langArray,
        hourly_rate: Number(hourlyRate) || 0,
      })
      if (res.error) {
        setError(res.error)
        setSaving(false)
        return
      }
    } else if (receptionUser) {
      const res = await updateReceptionUser(receptionUser.id, {
        full_name: fullName,
        phone,
      })
      if (res.error) {
        setError(res.error)
        setSaving(false)
        return
      }
    } else {
      const res = isTeacher
        ? await createTeacher({
            full_name: fullName,
            email,
            phone,
            languages: langArray,
            hourly_rate: Number(hourlyRate) || 0,
          })
        : await createReceptionUser({
            full_name: fullName,
            email,
            phone,
          })

      if (res.error) {
        setError(res.error)
        setSaving(false)
        return
      }

      if (res.tempPassword) {
        setTempPassword(res.tempPassword)
        setSaving(false)
        return
      }
    }

    setSaving(false)
    onSaved()
  }

  if (tempPassword) {
    return (
      <div className="modal-overlay" onClick={onClose}>
        <div className="brand-modal" onClick={(e) => e.stopPropagation()}>
          <h2 className="brand-modal-title">{isTeacher ? 'Professeur créé' : 'Réceptionniste créé'}</h2>
          <p className="brand-modal-copy">
            Un compte a été créé pour <strong>{fullName}</strong>. Communique ce mot de passe temporaire.
          </p>
          <div className="brand-modal-password">{tempPassword}</div>
          <button className="brand-staff-btn brand-staff-btn-primary" style={{ width: '100%' }} onClick={onSaved}>
            Fermer
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="brand-modal" onClick={(e) => e.stopPropagation()}>
        <div className="brand-modal-head">
          <h2 className="brand-modal-title">
            {teacher
              ? 'Modifier le professeur'
              : receptionUser
                ? 'Modifier le réceptionniste'
                : isTeacher
                  ? 'Ajouter un professeur'
                  : 'Ajouter un réceptionniste'}
          </h2>
          <button className="brand-modal-close" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        {error && <div className="brand-modal-error">{error}</div>}

        <form onSubmit={handleSubmit} className="brand-modal-form">
          <div>
            <label className="brand-modal-label">Nom complet *</label>
            <input className="input" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
          </div>

          {!teacher && !receptionUser && (
            <div>
              <label className="brand-modal-label">Email *</label>
              <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
          )}

          <div>
            <label className="brand-modal-label">Téléphone</label>
            <input className="input" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>

          {isTeacher && (
            <>
              <div>
                <label className="brand-modal-label">Langues</label>
                <input
                  className="input"
                  value={languages}
                  onChange={(e) => setLanguages(e.target.value)}
                  placeholder="Français, Anglais"
                />
              </div>
              <div>
                <label className="brand-modal-label">Taux horaire (€)</label>
                <input
                  className="input"
                  type="number"
                  step="0.01"
                  value={hourlyRate}
                  onChange={(e) => setHourlyRate(e.target.value)}
                />
              </div>
            </>
          )}

          <button className="brand-staff-btn brand-staff-btn-primary" type="submit" disabled={saving} style={{ width: '100%' }}>
            {saving ? (
              <>
                <div className="spinner" />
                Enregistrement...
              </>
            ) : teacher || receptionUser ? (
              'Mettre à jour'
            ) : isTeacher ? (
              'Créer le professeur'
            ) : (
              'Créer le réceptionniste'
            )}
          </button>
        </form>
      </div>
    </div>
  )
}
