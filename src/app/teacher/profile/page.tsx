import { getTeacherBadges, getUserProfile } from '@/lib/actions'
import { redirect } from 'next/navigation'
import { User, Mail, Phone } from 'lucide-react'
import { LogoutButton } from './logout-button'
import { DownloadReportButton } from '@/components/DownloadReportButton'

export default async function TeacherProfilePage() {
  const profile = await getUserProfile()
  if (!profile) redirect('/login')
  const badges = await getTeacherBadges()

  return (
    <div className="page-enter">
      <h1 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '1.25rem' }}>
        Mon profil
      </h1>

      <div className="card" style={{ marginBottom: '1rem' }}>
        <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
          <div style={{
            width: 72, height: 72, borderRadius: '50%',
            background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 0.75rem',
            color: 'white',
            fontSize: '1.5rem',
            fontWeight: 700,
          }}>
            {profile.full_name?.charAt(0)?.toUpperCase() || 'P'}
          </div>
          <p style={{ fontWeight: 700, fontSize: '1.125rem' }}>{profile.full_name || 'Professeur'}</p>
          <p style={{ color: '#64748b', fontSize: '0.875rem' }}>
            {profile.role === 'admin' ? 'Administrateur' : 'Professeur'}
          </p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{
              width: 36, height: 36, borderRadius: 10,
              background: '#eef2ff', display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Mail size={16} color="#6366f1" />
            </div>
            <div>
              <p style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Email</p>
              <p style={{ fontSize: '0.875rem', fontWeight: 500 }}>{profile.email}</p>
            </div>
          </div>
          {profile.phone && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <div style={{
                width: 36, height: 36, borderRadius: 10,
                background: '#d1fae5', display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Phone size={16} color="#10b981" />
              </div>
              <div>
                <p style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Téléphone</p>
                <p style={{ fontSize: '0.875rem', fontWeight: 500 }}>{profile.phone}</p>
              </div>
            </div>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{
              width: 36, height: 36, borderRadius: 10,
              background: '#fef3c7', display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <User size={16} color="#f59e0b" />
            </div>
            <div>
              <p style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Statut</p>
              <p style={{ fontSize: '0.875rem', fontWeight: 500 }}>
                {profile.status === 'active' ? 'Actif' : 'Inactif'}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="brand-card brand-card-pad" style={{ marginBottom: '1rem' }}>
        <div style={{ fontFamily: 'var(--font-serif-brand)', color: 'var(--brand-navy)', fontSize: '1.1rem', fontWeight: 700, marginBottom: '0.9rem' }}>
          Distinctions
        </div>
        {badges.length === 0 ? (
          <div style={{ color: 'var(--brand-muted)', fontSize: '0.9rem' }}>
            Aucune distinction pour le moment.
          </div>
        ) : (
          <div className="brand-badge-grid">
            {badges.map((badge) => (
              <div key={badge.id} className={`brand-creative-badge ${badge.tone}`}>
                <div className="brand-creative-badge-title">{badge.name}</div>
                <div className="brand-creative-badge-copy">{badge.description}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {profile.role === 'teacher' ? (
        <div style={{ marginBottom: '1rem' }}>
          <DownloadReportButton />
        </div>
      ) : null}

      <LogoutButton />
    </div>
  )
}
