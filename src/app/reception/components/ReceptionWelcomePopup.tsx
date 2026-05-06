'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'

function getGreeting() {
  const now = new Date()
  const hour = Number(
    now.toLocaleTimeString('fr-FR', {
      timeZone: 'Africa/Casablanca',
      hour: '2-digit',
      hour12: false,
    }),
  )

  return hour >= 18 ? 'Bonsoir' : 'Bonjour'
}

function getStorageKey() {
  const today = new Date().toLocaleDateString('fr-CA', {
    timeZone: 'Africa/Casablanca',
  })
  return `reception_welcome_popup_${today}`
}

export function ReceptionWelcomePopup({
  fullName,
}: {
  fullName?: string | null
}) {
  const [open, setOpen] = useState(() => {
    if (typeof window === 'undefined') return false
    return !window.localStorage.getItem(getStorageKey())
  })
  const greeting = useMemo(() => getGreeting(), [])
  const firstName = fullName?.split(' ')[0]

  const closePopup = () => {
    const key = getStorageKey()
    window.localStorage.setItem(key, '1')
    setOpen(false)
  }

  if (!open) return null

  return (
    <div style={overlayStyle}>
      <div style={modalStyle}>
        <div style={badgeStyle}>Rappel pointage</div>
        <h2 style={titleStyle}>
          {greeting}
          {firstName ? ` ${firstName}` : ''},
        </h2>
        <p style={copyStyle}>
          N&apos;oubliez pas de pointer votre arrivée avant de commencer la journée.
        </p>

        <div style={actionsStyle}>
          <button type="button" onClick={closePopup} style={secondaryButtonStyle}>
            Plus tard
          </button>
          <Link href="/pointage-reception" style={primaryLinkStyle} onClick={closePopup}>
            Aller au pointage
          </Link>
        </div>
      </div>
    </div>
  )
}

const overlayStyle = {
  position: 'fixed' as const,
  inset: 0,
  background: 'rgba(27, 45, 91, 0.35)',
  display: 'grid',
  placeItems: 'center',
  zIndex: 100,
  padding: '1rem',
}

const modalStyle = {
  width: 'min(460px, 100%)',
  background: '#FFFFFF',
  border: '1px solid #E8E2D5',
  borderRadius: 26,
  boxShadow: '0 20px 48px rgba(27,45,91,0.18)',
  padding: '1.4rem',
}

const badgeStyle = {
  display: 'inline-flex',
  borderRadius: 999,
  background: '#FAF3DE',
  color: '#A56D14',
  padding: '0.4rem 0.75rem',
  fontWeight: 800,
  fontSize: '0.78rem',
  marginBottom: '0.9rem',
}

const titleStyle = {
  margin: 0,
  color: '#1B2D5B',
  fontSize: '1.55rem',
  fontWeight: 800,
}

const copyStyle = {
  margin: '0.75rem 0 0',
  color: '#5C6680',
  lineHeight: 1.55,
}

const actionsStyle = {
  display: 'flex',
  justifyContent: 'flex-end',
  gap: '0.75rem',
  flexWrap: 'wrap' as const,
  marginTop: '1.2rem',
}

const secondaryButtonStyle = {
  border: '1px solid #E8E2D5',
  background: '#FFFFFF',
  color: '#1B2D5B',
  borderRadius: 14,
  padding: '0.75rem 1rem',
  fontWeight: 700,
  cursor: 'pointer',
}

const primaryLinkStyle = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  textDecoration: 'none',
  border: '1px solid #C9A84C',
  background: '#1B2D5B',
  color: '#FFFFFF',
  borderRadius: 14,
  padding: '0.75rem 1rem',
  fontWeight: 800,
}
