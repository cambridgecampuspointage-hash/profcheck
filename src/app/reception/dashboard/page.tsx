import Link from 'next/link'
import { ArrowLeft, Clock3, QrCode, Users } from 'lucide-react'
import { getAdminStats, getRooms, getUserProfile } from '@/lib/actions'
import { ReceptionWelcomePopup } from '@/app/reception/components/ReceptionWelcomePopup'
import type { Center, Room } from '@/lib/types'

export default async function ReceptionDashboard() {
  const rooms = await getRooms()
  const stats = await getAdminStats()
  const profile = await getUserProfile()

  return (
    <div>
      <ReceptionWelcomePopup fullName={profile?.full_name} />

      <div className="brand-page-header">
        {profile?.role === 'admin' && (
          <div style={{ marginBottom: '0.85rem' }}>
            <Link
              href="/admin/dashboard"
              className="brand-staff-btn brand-staff-btn-secondary"
              style={{ display: 'inline-flex', textDecoration: 'none' }}
            >
              <ArrowLeft size={16} />
              Retour à l&apos;accueil admin
            </Link>
          </div>
        )}
        <h1 className="brand-page-title">Accueil réception</h1>
        <p className="brand-page-subtitle">
          Bienvenue{profile?.full_name ? `, ${profile.full_name}` : ''}. Affiche rapidement les QR codes des salles.
        </p>
      </div>

      <div className="brand-kpi-grid" style={{ marginBottom: '1rem' }}>
        <div className="brand-card brand-kpi-card">
          <div className="brand-kpi-icon" style={{ background: '#eef1f8', color: '#1b2d5b' }}>
            <Users size={20} />
          </div>
          <div className="brand-kpi-value">{stats?.activeTeachersNow || 0}</div>
          <div className="brand-kpi-label">Professeurs présents</div>
        </div>

        <div className="brand-card brand-kpi-card">
          <div className="brand-kpi-icon" style={{ background: '#faeeda', color: '#ba7517' }}>
            <Clock3 size={20} />
          </div>
          <div className="brand-kpi-value">{Math.round(stats?.totalHoursToday || 0)}h</div>
          <div className="brand-kpi-label">Heures enregistrées aujourd&apos;hui</div>
        </div>
      </div>

      <section className="brand-card">
        <div className="brand-panel-header">
          <QrCode size={16} color="var(--brand-muted)" />
          <span className="brand-panel-title">QR des salles</span>
          <span className="brand-panel-action">{rooms.length} salle(s)</span>
        </div>

        {!rooms.length ? (
          <div className="brand-empty">Aucune salle disponible pour générer un QR code.</div>
        ) : (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
              gap: '1rem',
              padding: '1rem',
            }}
          >
            {rooms.map((room) => {
              const centerName = (room as Room & { center?: Center }).center?.name || 'Centre principal'
              return (
                <Link
                  key={room.id}
                  href={`/admin/qr-display/${room.id}`}
                  className="brand-card-soft"
                  style={{ padding: '1rem', textDecoration: 'none', color: 'inherit' }}
                >
                  <div
                    style={{
                      width: 46,
                      height: 46,
                      borderRadius: 14,
                      background: '#eef1f8',
                      color: '#1b2d5b',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginBottom: '0.9rem',
                    }}
                  >
                    <QrCode size={22} />
                  </div>
                  <div className="brand-action-title">{room.name}</div>
                  <div className="brand-action-copy">{centerName}</div>
                </Link>
              )
            })}
          </div>
        )}
      </section>
    </div>
  )
}
