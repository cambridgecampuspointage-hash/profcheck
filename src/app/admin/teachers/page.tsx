'use client'

import { useEffect, useState } from 'react'
import {
  createReceptionUser,
  createTeacher,
  deleteTeacher,
  getTeacherBadgeSummaries,
  getReceptionUsers,
  getTeachers,
  resetReceptionPassword,
  resetTeacherPassword,
  updateReceptionUser,
  updateTeacher,
} from '@/lib/actions'
import type { ReceptionUser, Teacher, TeacherBadgeSummary } from '@/lib/types'
import { Edit2, KeyRound, Loader2, Plus, ShieldCheck, Trash2, UserCheck, UserX, X } from 'lucide-react'

function formatTeacherRate(value?: number | null, fallback?: number | null) {
  return Number(value ?? fallback ?? 0).toLocaleString('fr-MA', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

export default function TeachersPage() {
  const [teachers, setTeachers] = useState<Teacher[]>([])
  const [badgeSummaries, setBadgeSummaries] = useState<TeacherBadgeSummary[]>([])
  const [receptionUsers, setReceptionUsers] = useState<ReceptionUser[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingTeacher, setEditingTeacher] = useState<Teacher | null>(null)
  const [editingReception, setEditingReception] = useState<ReceptionUser | null>(null)
  const [modalRole, setModalRole] = useState<'teacher' | 'reception'>('teacher')
  const [deletingTeacherId, setDeletingTeacherId] = useState<string | null>(null)
  const [resettingId, setResettingId] = useState<string | null>(null)
  const [resetPasswordInfo, setResetPasswordInfo] = useState<{ name: string; password: string } | null>(null)

  const fetchData = async () => {
    setLoading(true)
    const [teacherData, receptionData, teacherBadges] = await Promise.all([
      getTeachers(),
      getReceptionUsers(),
      getTeacherBadgeSummaries(),
    ])
    setTeachers(teacherData as Teacher[])
    setReceptionUsers(receptionData as ReceptionUser[])
    setBadgeSummaries(teacherBadges as TeacherBadgeSummary[])
    setLoading(false)
  }

  useEffect(() => {
    let active = true

    async function loadData() {
      const [teacherData, receptionData, teacherBadges] = await Promise.all([
        getTeachers(),
        getReceptionUsers(),
        getTeacherBadgeSummaries(),
      ])
      if (!active) return
      setTeachers(teacherData as Teacher[])
      setReceptionUsers(receptionData as ReceptionUser[])
      setBadgeSummaries(teacherBadges as TeacherBadgeSummary[])
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

  const handleDeleteTeacher = async (teacher: Teacher) => {
    const confirmation = window.prompt(
      `Pour supprimer définitivement ${teacher.full_name}, tapez SUPPRIMER`
    )

    if (confirmation !== 'SUPPRIMER') return

    setDeletingTeacherId(teacher.id)
    const result = await deleteTeacher(teacher.id)
    setDeletingTeacherId(null)

    if (result.error) {
      window.alert(result.error)
      return
    }

    void fetchData()
  }

  const handleResetTeacherPassword = async (teacher: Teacher) => {
    setResettingId(`teacher-${teacher.id}`)
    const result = await resetTeacherPassword(teacher.id)
    setResettingId(null)

    if (result.error || !result.tempPassword) {
      window.alert(result.error || 'Réinitialisation impossible.')
      return
    }

    setResetPasswordInfo({
      name: result.fullName || teacher.full_name,
      password: result.tempPassword,
    })
  }

  const handleResetReceptionPassword = async (profile: ReceptionUser) => {
    setResettingId(`reception-${profile.id}`)
    const result = await resetReceptionPassword(profile.id)
    setResettingId(null)

    if (result.error || !result.tempPassword) {
      window.alert(result.error || 'Réinitialisation impossible.')
      return
    }

    setResetPasswordInfo({
      name: result.fullName || profile.full_name || 'Réceptionniste',
      password: result.tempPassword,
    })
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
                      <th>Tarif 1h / 2h</th>
                      <th>Tarif 1h30 / 3h</th>
                      <th>Badges</th>
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
                        <td>{formatTeacherRate(teacher.hourly_rate_short, teacher.hourly_rate)} MAD/h</td>
                        <td>{formatTeacherRate(teacher.hourly_rate_long, teacher.hourly_rate)} MAD/h</td>
                        <td>
                          <div className="brand-badge-chip-list">
                            {(badgeSummaries.find((summary) => summary.teacher_id === teacher.id)?.badges || []).slice(0, 2).map((badge) => (
                              <span key={badge.id} className={`brand-mini-badge ${badge.tone}`}>
                                {badge.name}
                              </span>
                            ))}
                            {!((badgeSummaries.find((summary) => summary.teacher_id === teacher.id)?.badges || []).length) && (
                              <span style={{ color: 'var(--brand-subtle)', fontSize: '0.78rem' }}>Aucun</span>
                            )}
                          </div>
                        </td>
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
                              title="Modifier"
                            >
                              <Edit2 size={15} />
                            </button>
                            <button
                              className="brand-staff-icon-btn"
                              onClick={() => handleResetTeacherPassword(teacher)}
                              title="Générer un mot de passe"
                            >
                              {resettingId === `teacher-${teacher.id}` ? <Loader2 size={15} style={{ animation: 'spin 1s linear infinite' }} /> : <KeyRound size={15} />}
                            </button>
                            <button
                              className={`brand-staff-icon-btn ${teacher.status === 'active' ? 'danger' : 'success'}`}
                              onClick={() => handleToggleStatus(teacher)}
                              title={teacher.status === 'active' ? 'Désactiver' : 'Réactiver'}
                            >
                              {teacher.status === 'active' ? <UserX size={15} /> : <UserCheck size={15} />}
                            </button>
                            <button
                              className="brand-staff-icon-btn danger"
                              disabled={deletingTeacherId === teacher.id}
                              onClick={() => handleDeleteTeacher(teacher)}
                              title="Supprimer définitivement"
                            >
                              {deletingTeacherId === teacher.id ? <Loader2 size={15} style={{ animation: 'spin 1s linear infinite' }} /> : <Trash2 size={15} />}
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
                              title="Modifier"
                            >
                              <Edit2 size={15} />
                            </button>
                            <button
                              className="brand-staff-icon-btn"
                              onClick={() => handleResetReceptionPassword(profile)}
                              title="Générer un mot de passe"
                            >
                              {resettingId === `reception-${profile.id}` ? <Loader2 size={15} style={{ animation: 'spin 1s linear infinite' }} /> : <KeyRound size={15} />}
                            </button>
                            <button
                              className={`brand-staff-icon-btn ${profile.status === 'active' ? 'danger' : 'success'}`}
                              onClick={() => handleToggleReceptionStatus(profile)}
                              title={profile.status === 'active' ? 'Désactiver' : 'Réactiver'}
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

      {resetPasswordInfo && (
        <div className="modal-overlay" onClick={() => setResetPasswordInfo(null)}>
          <div className="brand-modal" onClick={(e) => e.stopPropagation()}>
            <h2 className="brand-modal-title">Mot de passe réinitialisé</h2>
            <p className="brand-modal-copy">
              Un nouveau mot de passe temporaire a été généré pour <strong>{resetPasswordInfo.name}</strong>.
            </p>
            <div className="brand-modal-password">{resetPasswordInfo.password}</div>
            <button
              className="brand-staff-btn brand-staff-btn-primary"
              style={{ width: '100%' }}
              onClick={() => setResetPasswordInfo(null)}
            >
              Fermer
            </button>
          </div>
        </div>
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
  const [hourlyRateShort, setHourlyRateShort] = useState(String(teacher?.hourly_rate_short ?? teacher?.hourly_rate ?? '75'))
  const [hourlyRateLong, setHourlyRateLong] = useState(String(teacher?.hourly_rate_long ?? teacher?.hourly_rate ?? '66.67'))
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
        hourly_rate_short: Number(hourlyRateShort) || 0,
        hourly_rate_long: Number(hourlyRateLong) || 0,
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
            hourly_rate_short: Number(hourlyRateShort) || 0,
            hourly_rate_long: Number(hourlyRateLong) || 0,
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
                <label className="brand-modal-label">Tarif horaire 1h / 2h (MAD)</label>
                <input
                  className="input"
                  type="number"
                  step="0.01"
                  value={hourlyRateShort}
                  onChange={(e) => setHourlyRateShort(e.target.value)}
                />
              </div>
              <div>
                <label className="brand-modal-label">Tarif horaire 1h30 / 3h (MAD)</label>
                <input
                  className="input"
                  type="number"
                  step="0.01"
                  value={hourlyRateLong}
                  onChange={(e) => setHourlyRateLong(e.target.value)}
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
