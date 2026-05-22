'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { AlertCircle, ArrowRight, Eye, EyeOff } from 'lucide-react'
import Link from 'next/link'
import Image from 'next/image'
import { Playfair_Display, Plus_Jakarta_Sans } from 'next/font/google'

const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ['latin'],
  display: 'swap',
})

const playfairDisplay = Playfair_Display({
  subsets: ['latin'],
  display: 'swap',
  weight: ['600', '700', '800', '900'],
})

type Particle = {
  x: number
  y: number
  vx: number
  vy: number
  radius: number
  alpha: number
}

export default function LoginPage() {
  const demoEnabled = process.env.NEXT_PUBLIC_ENABLE_DEMO_LOGIN === 'true'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [statValues, setStatValues] = useState([0, 0, 0, 0])
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    const targets = [12, 2, 4, 0]
    let frame = 0
    let startTime: number | null = null

    const tick = (time: number) => {
      if (startTime === null) startTime = time
      const progress = Math.min((time - startTime) / 1200, 1)
      setStatValues(targets.map((target) => Math.round(target * progress)))
      if (progress < 1) {
        frame = requestAnimationFrame(tick)
      }
    }

    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let frame = 0
    let particles: Particle[] = []

    const init = () => {
      const rect = canvas.getBoundingClientRect()
      const ratio = window.devicePixelRatio || 1
      canvas.width = rect.width * ratio
      canvas.height = rect.height * ratio
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0)

      const count = Math.max(22, Math.floor(rect.width / 36))
      particles = Array.from({ length: count }, () => ({
        x: Math.random() * rect.width,
        y: Math.random() * rect.height,
        vx: (Math.random() - 0.5) * 0.24,
        vy: (Math.random() - 0.5) * 0.24,
        radius: Math.random() * 1.8 + 0.8,
        alpha: Math.random() * 0.45 + 0.08,
      }))
    }

    const draw = () => {
      const rect = canvas.getBoundingClientRect()
      ctx.clearRect(0, 0, rect.width, rect.height)

      particles.forEach((particle, index) => {
        particle.x += particle.vx
        particle.y += particle.vy

        if (particle.x < 0 || particle.x > rect.width) particle.vx *= -1
        if (particle.y < 0 || particle.y > rect.height) particle.vy *= -1

        ctx.beginPath()
        ctx.fillStyle = `rgba(232, 185, 35, ${particle.alpha})`
        ctx.arc(particle.x, particle.y, particle.radius, 0, Math.PI * 2)
        ctx.fill()

        for (let i = index + 1; i < particles.length; i += 1) {
          const other = particles[i]
          const dx = particle.x - other.x
          const dy = particle.y - other.y
          const dist = Math.hypot(dx, dy)

          if (dist < 90) {
            ctx.beginPath()
            ctx.strokeStyle = `rgba(232, 185, 35, ${(1 - dist / 90) * 0.08})`
            ctx.lineWidth = 1
            ctx.moveTo(particle.x, particle.y)
            ctx.lineTo(other.x, other.y)
            ctx.stroke()
          }
        }
      })

      frame = requestAnimationFrame(draw)
    }

    init()
    draw()
    window.addEventListener('resize', init)

    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('resize', init)
    }
  }, [])

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    if (demoEnabled && email === 'admin@profcheck.com' && password === 'password123') {
      document.cookie = 'demo-session=true; path=/; max-age=3600'
      document.cookie = 'demo-role=admin; path=/; max-age=3600'
      router.push('/admin/dashboard')
      router.refresh()
      return
    }

    if (demoEnabled && email === 'teacher@profcheck.com' && password === 'password123') {
      document.cookie = 'demo-session=true; path=/; max-age=3600'
      document.cookie = 'demo-role=teacher; path=/; max-age=3600'
      router.push('/teacher/dashboard')
      router.refresh()
      return
    }

    if (demoEnabled && email === 'reception@profcheck.com' && password === 'password123') {
      document.cookie = 'demo-session=true; path=/; max-age=3600'
      document.cookie = 'demo-role=reception; path=/; max-age=3600'
      router.push('/reception/dashboard')
      router.refresh()
      return
    }

    const { error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (authError) {
      setError('Email ou mot de passe incorrect.')
      setLoading(false)
      return
    }

    router.push('/')
    router.refresh()
  }

  return (
    <>
      <div className={`${plusJakartaSans.className} page`}>
        <aside className="left-panel">
          <canvas ref={canvasRef} className="particles-canvas" />
          <div className="aurora aurora-1" />
          <div className="aurora aurora-2" />
          <div className="dot-pattern" />
          <div className="ring ring-1" />
          <div className="ring ring-2" />
          <div className="ring ring-3" />

          <div className="left-content">
            <div className="logo-block">
              <div className="logo-circle">
                <Image
                  src="/cambridge_campus_rabat_logo.png"
                  alt="Cambridge Campus"
                  width={44}
                  height={44}
                  className="logo-image"
                />
              </div>
              <div className="logo-text-block">
                <div className="logo-name">Cambridge Campus</div>
                <div className="logo-sub">Administration · ProfCheck</div>
              </div>
            </div>

            <div className="hero">
              <div className="hero-tag">
                <span className="tag-line" />
                <span className="tag-text">Practice Makes Perfect</span>
              </div>
              <h1 className={`${playfairDisplay.className} hero-title`}>
                <span className="word">Bienvenue</span>
                <span className="word">sur</span>
                <span className="word gold">ProfCheck</span>
              </h1>
              <p>
                Plateforme intelligente de gestion et de pointage pour les enseignants,
                la reception et l&apos;administration de votre centre.
              </p>
            </div>

            <div className="spacer" />

            <div className="dashboard-wrap">
              <div className="live-badge">
                <span className="pulse-dot" />
                <span>12 sessions actives</span>
              </div>

              <div className="dashboard-card">
                <div className="dash-header">
                  <div className="dash-header-left">
                    <div className="dash-icon-box">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round">
                        <line x1="4" y1="6" x2="20" y2="6" />
                        <line x1="4" y1="12" x2="20" y2="12" />
                        <line x1="4" y1="18" x2="20" y2="18" />
                      </svg>
                    </div>
                    <span className="dash-title">Tableau de bord</span>
                  </div>
                  <span className="dash-date">Aujourd&apos;hui</span>
                </div>

                <div className="stats-grid">
                  {[
                    { label: 'Sessions', accent: 'emerald' },
                    { label: 'Absences', accent: 'red' },
                    { label: 'A venir', accent: 'navy' },
                    { label: 'Hors plan.', accent: 'gold' },
                  ].map((stat, index) => (
                    <div
                      key={stat.label}
                      className={`stat-card stat-${stat.accent}`}
                      style={{ animationDelay: `${1.7 + index * 0.1}s` }}
                    >
                      <div className="stat-label">{stat.label}</div>
                      <div className="stat-value">{statValues[index]}</div>
                    </div>
                  ))}
                </div>

                <div className="timeline-wrap">
                  <div className="timeline">
                    <div className="timeline-title">Timeline du jour</div>
                    {[
                      { time: '14:30', name: 'Ouassim samad', tagClass: 'tag-prevu', tag: 'Prevu' },
                      { time: '18:30', name: 'Fatima Zahra', tagClass: 'tag-pointe', tag: 'Pointe' },
                      { time: '19:00', name: 'Malak El MALKY', tagClass: 'tag-encours', tag: 'En cours' },
                    ].map((row, index) => (
                      <div
                        key={`${row.time}-${row.name}`}
                        className="timeline-row"
                        style={{ animationDelay: `${2.2 + index * 0.15}s` }}
                      >
                        <span className="row-time">{row.time}</span>
                        <span className="row-name">{row.name}</span>
                        <span className={`row-tag ${row.tagClass}`}>{row.tag}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="left-footer">
              <div className="copyright">© 2026 Cambridge Campus</div>
              <div className="pagination">
                <span className="active" />
                <span />
                <span />
              </div>
            </div>
          </div>
        </aside>

        <main className="right-panel">
          <div className="form-container">
            <div className="mobile-brand">
              <div className="mobile-logo-circle">
                <Image
                  src="/cambridge_campus_rabat_logo.png"
                  alt="Cambridge Campus"
                  width={28}
                  height={28}
                />
              </div>
              <div>
                <div className="mobile-logo-name">Cambridge Campus</div>
                <div className="mobile-logo-sub">ProfCheck</div>
              </div>
            </div>

            <div className="badge">
              <span className="badge-dot" />
              <span className="badge-text">ESPACE SECURISE</span>
            </div>

            <h2 className={`${playfairDisplay.className} form-title`}>Connexion</h2>
            <p className="form-subtitle">
              Connectez-vous pour acceder a votre tableau de bord.
            </p>

            <form className="form" onSubmit={handleLogin}>
              <div className="field">
                <div className="field-header">
                  <label className="field-label" htmlFor="email">Adresse e-mail</label>
                </div>
                <div className="input-wrap">
                  <div className="input-icon">
                    <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                      <path d="M3 8l9 6 9-6M5 19h14a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2z" />
                    </svg>
                  </div>
                  <input
                    id="email"
                    className="input"
                    type="email"
                    placeholder="nom@cambridge-campus.ma"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoComplete="email"
                  />
                </div>
              </div>

              <div className="field">
                <div className="field-header">
                  <label className="field-label" htmlFor="password">Mot de passe</label>
                  <Link href="/forgot-password" className="field-link">
                    Oublie ?
                  </Link>
                </div>
                <div className="input-wrap">
                  <div className="input-icon">
                    <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                      <path d="M12 15v2m-6 4h12a2 2 0 0 0 2-2v-6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2zm10-10V7a4 4 0 0 0-8 0v4h8z" />
                    </svg>
                  </div>
                  <input
                    id="password"
                    className="input"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    className="toggle-pwd"
                    onClick={() => setShowPassword((current) => !current)}
                    aria-label={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              {error ? (
                <div className="error-banner show">
                  <AlertCircle size={16} />
                  <span>{error}</span>
                </div>
              ) : null}

              <button type="submit" className="submit-btn" disabled={loading}>
                <span className="btn-content">
                  {loading ? 'Connexion...' : 'Se connecter'}
                  {loading ? <span className="spinner" /> : <ArrowRight size={16} className="btn-arrow" />}
                </span>
              </button>

              {demoEnabled ? (
                <p className="demo-note">
                  Mode demo actif: utilisez les comptes admin, teacher ou reception preconfigures.
                </p>
              ) : null}
            </form>

            <div className="form-footer">
              <div className="help-text">
                Besoin d&apos;aide ? <a href="#">Contactez l&apos;admin</a>
              </div>
              <div className="ssl">
                <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path d="M12 15v2m-6 4h12a2 2 0 0 0 2-2v-6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2zm10-10V7a4 4 0 0 0-8 0v4h8z" />
                </svg>
                <span>Securise SSL</span>
              </div>
            </div>
          </div>
        </main>
      </div>

      <style jsx>{`
        :global(*) {
          box-sizing: border-box;
          margin: 0;
          padding: 0;
        }

        :global(html, body) {
          height: 100%;
          overflow: hidden;
          background: #faf6ee;
          color: #0f1f4c;
          -webkit-font-smoothing: antialiased;
        }

        .page {
          height: 100vh;
          width: 100%;
          display: flex;
          overflow: hidden;
          position: relative;
          background: #faf6ee;
        }

        .left-panel {
          width: 50%;
          position: relative;
          overflow: hidden;
          background:
            radial-gradient(circle at 20% 20%, rgba(232, 185, 35, 0.1) 0%, transparent 45%),
            radial-gradient(circle at 80% 80%, rgba(232, 185, 35, 0.07) 0%, transparent 50%),
            linear-gradient(135deg, #0f1f4c 0%, #0a1638 100%);
          display: flex;
          flex-direction: column;
        }

        .particles-canvas {
          position: absolute;
          inset: 0;
          z-index: 1;
          opacity: 0.7;
          pointer-events: none;
        }

        .ring {
          position: absolute;
          border: 1px solid rgba(232, 185, 35, 0.15);
          border-radius: 50%;
          pointer-events: none;
        }

        .ring-1 {
          width: 480px;
          height: 480px;
          top: -160px;
          right: -160px;
          animation: rotate 60s linear infinite;
        }

        .ring-2 {
          width: 360px;
          height: 360px;
          top: -100px;
          right: -100px;
          animation: rotate 45s linear infinite reverse;
          border-color: rgba(232, 185, 35, 0.1);
        }

        .ring-3 {
          width: 240px;
          height: 240px;
          top: -40px;
          right: -40px;
          animation: rotate 30s linear infinite;
          border-color: rgba(232, 185, 35, 0.2);
          border-style: dashed;
        }

        .dot-pattern {
          position: absolute;
          inset: 0;
          background-image: radial-gradient(rgba(232, 185, 35, 0.15) 1px, transparent 1px);
          background-size: 28px 28px;
          opacity: 0.4;
          z-index: 1;
          pointer-events: none;
          animation: panBg 80s linear infinite;
        }

        .aurora {
          position: absolute;
          width: 600px;
          height: 600px;
          border-radius: 50%;
          filter: blur(80px);
          opacity: 0.3;
          z-index: 1;
          pointer-events: none;
          animation: floatAurora 20s ease-in-out infinite;
        }

        .aurora-1 {
          background: radial-gradient(circle, rgba(232, 185, 35, 0.5), transparent 70%);
          top: -200px;
          left: -200px;
        }

        .aurora-2 {
          background: radial-gradient(circle, rgba(59, 130, 246, 0.3), transparent 70%);
          bottom: -200px;
          right: -100px;
          animation-delay: -10s;
        }

        .left-content {
          position: relative;
          z-index: 10;
          display: flex;
          flex-direction: column;
          height: 100%;
          padding: 2.5rem;
        }

        .logo-block {
          display: flex;
          align-items: center;
          gap: 0.875rem;
          flex-shrink: 0;
          opacity: 0;
          animation: slideDown 0.8s 0.2s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }

        .logo-circle {
          width: 64px;
          height: 64px;
          background: #fff;
          border-radius: 16px;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 20px 40px -10px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(255, 255, 255, 0.1);
          position: relative;
          overflow: hidden;
        }

        .logo-circle::before {
          content: '';
          position: absolute;
          inset: 0;
          background: linear-gradient(135deg, transparent 30%, rgba(232, 185, 35, 0.2) 50%, transparent 70%);
          transform: translateX(-100%);
          animation: shimmer 3s ease-in-out infinite;
        }

        .logo-image {
          position: relative;
          z-index: 2;
          width: 44px;
          height: 44px;
          object-fit: contain;
        }

        .logo-name {
          color: #fff;
          font-size: 1.375rem;
          font-weight: 800;
          letter-spacing: -0.02em;
          line-height: 1;
        }

        .logo-sub {
          color: #e8b923;
          font-size: 0.625rem;
          font-weight: 700;
          letter-spacing: 0.25em;
          text-transform: uppercase;
          margin-top: 0.375rem;
        }

        .hero {
          margin-top: 3rem;
          flex-shrink: 0;
        }

        .hero-tag {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          margin-bottom: 1rem;
          opacity: 0;
          animation: slideRight 0.8s 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }

        .tag-line {
          height: 1px;
          width: 40px;
          background: #e8b923;
          transform-origin: left;
          animation: growLine 0.8s 0.8s ease-out forwards;
          transform: scaleX(0);
        }

        .tag-text {
          color: #e8b923;
          font-size: 0.6875rem;
          font-weight: 700;
          letter-spacing: 0.28em;
          text-transform: uppercase;
        }

        .hero-title {
          color: #fff;
          font-size: 3.25rem;
          font-weight: 700;
          line-height: 1.05;
          letter-spacing: -0.02em;
          max-width: 480px;
          display: flex;
          flex-wrap: wrap;
          gap: 0 0.45rem;
        }

        .word {
          display: inline-block;
          opacity: 0;
          transform: translateY(20px);
          animation: wordUp 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }

        .word:nth-child(1) {
          animation-delay: 0.7s;
        }

        .word:nth-child(2) {
          animation-delay: 0.85s;
        }

        .word.gold {
          color: #e8b923;
          animation-delay: 1.05s;
          position: relative;
        }

        .word.gold::after {
          content: '';
          position: absolute;
          left: 0;
          bottom: -4px;
          width: 0;
          height: 3px;
          background: #e8b923;
          border-radius: 2px;
          animation: underline 0.8s 1.6s ease-out forwards;
        }

        .hero p {
          color: rgba(203, 213, 225, 0.9);
          font-size: 0.9375rem;
          line-height: 1.6;
          margin-top: 1.5rem;
          max-width: 440px;
          opacity: 0;
          animation: fadeIn 0.8s 1.2s ease-out forwards;
        }

        .spacer {
          flex: 1;
          min-height: 1rem;
        }

        .dashboard-wrap {
          flex-shrink: 0;
          position: relative;
          opacity: 0;
          transform: translateY(40px) perspective(1000px) rotateX(10deg);
          animation: dashIn 1s 1.4s cubic-bezier(0.16, 1, 0.3, 1) forwards;
          transform-style: preserve-3d;
        }

        .dashboard-wrap:hover {
          transform: translateY(0) perspective(1000px) rotateX(0deg) rotateY(-3deg);
          transition: transform 0.4s ease;
        }

        .live-badge {
          position: absolute;
          top: -14px;
          right: 16px;
          z-index: 20;
          background: #fff;
          border-radius: 10px;
          padding: 6px 12px;
          box-shadow: 0 10px 30px -5px rgba(0, 0, 0, 0.4);
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 0.6875rem;
          font-weight: 700;
          color: #0f1f4c;
          animation: floatBadge 3s ease-in-out infinite;
        }

        .pulse-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: #10b981;
          position: relative;
        }

        .pulse-dot::before {
          content: '';
          position: absolute;
          inset: -2px;
          border-radius: 50%;
          background: #10b981;
          opacity: 0.4;
          animation: ping 1.5s ease-in-out infinite;
        }

        .dashboard-card {
          background: #faf6ee;
          border-radius: 14px;
          overflow: hidden;
          box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.1);
        }

        .dash-header {
          background: #fff;
          padding: 10px 16px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          border-bottom: 1px solid #f1f5f9;
        }

        .dash-header-left {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .dash-icon-box {
          width: 24px;
          height: 24px;
          background: #0f1f4c;
          border-radius: 6px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .dash-title {
          color: #0f1f4c;
          font-weight: 700;
          font-size: 0.75rem;
        }

        .dash-date {
          color: #94a3b8;
          font-size: 0.6875rem;
          font-weight: 500;
        }

        .stats-grid {
          padding: 12px;
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 8px;
        }

        .stat-card {
          background: #fff;
          border-radius: 8px;
          padding: 8px;
          border-top: 2px solid;
          opacity: 0;
          transform: translateY(10px);
          animation: statIn 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }

        .stat-emerald {
          border-color: #10b981;
        }

        .stat-red {
          border-color: #f87171;
        }

        .stat-navy {
          border-color: #0f1f4c;
        }

        .stat-gold {
          border-color: #e8b923;
        }

        .stat-label {
          font-size: 0.5rem;
          color: #64748b;
          font-weight: 700;
          letter-spacing: 0.1em;
          text-transform: uppercase;
        }

        .stat-value {
          font-size: 1rem;
          font-weight: 800;
          color: #0f1f4c;
          margin-top: 2px;
        }

        .timeline-wrap {
          padding: 0 12px 12px;
        }

        .timeline {
          background: #fff;
          border-radius: 8px;
          padding: 10px;
        }

        .timeline-title {
          font-size: 0.5625rem;
          color: #94a3b8;
          font-weight: 700;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          margin-bottom: 6px;
        }

        .timeline-row {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 3px 0;
          opacity: 0;
          transform: translateX(-10px);
          animation: rowIn 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }

        .row-time {
          font-size: 0.625rem;
          font-weight: 700;
          color: #475569;
          width: 36px;
        }

        .row-name {
          font-size: 0.6875rem;
          font-weight: 600;
          color: #0f1f4c;
          flex: 1;
        }

        .row-tag {
          font-size: 0.5625rem;
          font-weight: 700;
          padding: 2px 6px;
          border-radius: 4px;
        }

        .tag-prevu {
          background: #f1f5f9;
          color: #475569;
        }

        .tag-pointe {
          background: #d1fae5;
          color: #065f46;
        }

        .tag-encours {
          background: #0f1f4c;
          color: #e8b923;
        }

        .left-footer {
          margin-top: 1.25rem;
          padding-top: 1rem;
          border-top: 1px solid rgba(255, 255, 255, 0.1);
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-shrink: 0;
          opacity: 0;
          animation: fadeIn 0.8s 2.6s ease-out forwards;
        }

        .copyright {
          font-size: 0.6875rem;
          color: #94a3b8;
        }

        .pagination {
          display: flex;
          gap: 6px;
        }

        .pagination span {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: rgba(255, 255, 255, 0.3);
        }

        .pagination span.active {
          background: #e8b923;
          width: 18px;
          border-radius: 3px;
          transition: all 0.3s;
        }

        .right-panel {
          width: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 2.5rem;
          position: relative;
          overflow-y: auto;
          background: #faf6ee;
        }

        .right-panel::before {
          content: '';
          position: absolute;
          top: 0;
          right: 0;
          width: 280px;
          height: 280px;
          background-image: radial-gradient(rgba(232, 185, 35, 0.18) 1px, transparent 1px);
          background-size: 24px 24px;
          opacity: 0.5;
          pointer-events: none;
        }

        .right-panel::after {
          content: '';
          position: absolute;
          bottom: 0;
          left: 0;
          width: 200px;
          height: 200px;
          background: radial-gradient(circle, rgba(15, 31, 76, 0.06), transparent 70%);
          pointer-events: none;
        }

        .form-container {
          width: 100%;
          max-width: 440px;
          position: relative;
          z-index: 10;
        }

        .mobile-brand {
          display: none;
          align-items: center;
          gap: 12px;
          margin-bottom: 2rem;
        }

        .mobile-logo-circle {
          width: 48px;
          height: 48px;
          border-radius: 14px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #0f1f4c;
          box-shadow: 0 12px 28px rgba(15, 31, 76, 0.18);
        }

        .mobile-logo-name {
          color: #0f1f4c;
          font-size: 1.05rem;
          font-weight: 800;
          line-height: 1;
        }

        .mobile-logo-sub {
          margin-top: 0.35rem;
          color: #e8b923;
          font-size: 0.625rem;
          font-weight: 800;
          letter-spacing: 0.2em;
          text-transform: uppercase;
        }

        .badge {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          background: #fff;
          border: 1px solid rgba(232, 185, 35, 0.4);
          border-radius: 999px;
          padding: 6px 14px;
          margin-bottom: 1.25rem;
          opacity: 0;
          transform: translateY(-10px);
          animation: slideDown 0.6s 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }

        .badge-dot {
          width: 6px;
          height: 6px;
          background: #e8b923;
          border-radius: 50%;
          box-shadow: 0 0 12px #e8b923;
          animation: glowPulse 2s ease-in-out infinite;
        }

        .badge-text {
          color: #0f1f4c;
          font-size: 0.6875rem;
          font-weight: 800;
          letter-spacing: 0.05em;
        }

        .form-title {
          font-size: 3.25rem;
          font-weight: 700;
          color: #0f1f4c;
          letter-spacing: -0.02em;
          line-height: 1.05;
          opacity: 0;
          animation: slideRight 0.7s 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }

        .form-subtitle {
          color: #475569;
          font-size: 0.9375rem;
          margin-top: 0.625rem;
          opacity: 0;
          animation: fadeIn 0.7s 0.7s ease-out forwards;
        }

        .form {
          margin-top: 2rem;
          display: flex;
          flex-direction: column;
          gap: 1.125rem;
        }

        .field {
          opacity: 0;
          transform: translateY(15px);
          animation: fieldIn 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }

        .field:nth-of-type(1) {
          animation-delay: 0.85s;
        }

        .field:nth-of-type(2) {
          animation-delay: 1s;
        }

        .field-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 6px;
        }

        .field-label {
          font-size: 0.8125rem;
          font-weight: 700;
          color: #0f1f4c;
        }

        .field-link {
          font-size: 0.8125rem;
          font-weight: 700;
          color: #0f1f4c;
          text-decoration: none;
          transition: color 0.2s;
        }

        .field-link:hover {
          color: #c49a1a;
        }

        .input-wrap {
          position: relative;
          background: #fff;
          border: 1.5px solid #e2e8f0;
          border-radius: 12px;
          transition: all 0.25s ease;
          overflow: hidden;
        }

        .input-wrap::before {
          content: '';
          position: absolute;
          inset: 0;
          border-radius: 12px;
          background: linear-gradient(120deg, transparent 30%, rgba(232, 185, 35, 0.15) 50%, transparent 70%);
          transform: translateX(-100%);
          transition: transform 0.6s;
          pointer-events: none;
        }

        .input-wrap:focus-within {
          border-color: #0f1f4c;
          box-shadow: 0 0 0 4px rgba(15, 31, 76, 0.08), 0 8px 24px -10px rgba(15, 31, 76, 0.2);
          transform: translateY(-1px);
        }

        .input-wrap:focus-within::before {
          transform: translateX(100%);
        }

        .input-icon {
          position: absolute;
          left: 14px;
          top: 50%;
          transform: translateY(-50%);
          color: #94a3b8;
          transition: color 0.25s;
          pointer-events: none;
          z-index: 2;
        }

        .input-wrap:focus-within .input-icon {
          color: #0f1f4c;
        }

        .input {
          width: 100%;
          border: none;
          background: transparent;
          padding: 14px 44px 14px 44px;
          font-size: 0.9375rem;
          font-weight: 500;
          color: #0f1f4c;
          font-family: inherit;
          outline: none;
          position: relative;
          z-index: 1;
        }

        .input::placeholder {
          color: #94a3b8;
          font-weight: 400;
        }

        .toggle-pwd {
          position: absolute;
          right: 14px;
          top: 50%;
          transform: translateY(-50%);
          background: none;
          border: none;
          color: #94a3b8;
          cursor: pointer;
          padding: 4px;
          border-radius: 6px;
          transition: color 0.2s;
          z-index: 2;
        }

        .toggle-pwd:hover {
          color: #0f1f4c;
        }

        .submit-btn {
          margin-top: 0.5rem;
          width: 100%;
          background: #0f1f4c;
          color: #fff;
          border: none;
          border-radius: 12px;
          padding: 16px;
          font-size: 0.9375rem;
          font-weight: 700;
          font-family: inherit;
          cursor: pointer;
          position: relative;
          overflow: hidden;
          box-shadow: 0 10px 30px -10px rgba(15, 31, 76, 0.4);
          transition: all 0.3s ease;
          opacity: 0;
          transform: translateY(15px);
          animation: fieldIn 0.6s 1.15s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }

        .submit-btn:hover {
          background: #1b2d5e;
          transform: translateY(-2px);
          box-shadow: 0 20px 40px -10px rgba(15, 31, 76, 0.5);
        }

        .submit-btn:active {
          transform: translateY(0);
        }

        .submit-btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .submit-btn::before {
          content: '';
          position: absolute;
          top: 0;
          left: -100%;
          width: 100%;
          height: 100%;
          background: linear-gradient(120deg, transparent, rgba(232, 185, 35, 0.3), transparent);
          transition: left 0.7s;
        }

        .submit-btn:hover::before {
          left: 100%;
        }

        .submit-btn::after {
          content: '';
          position: absolute;
          bottom: 0;
          left: 0;
          width: 100%;
          height: 3px;
          background: #e8b923;
          transform: scaleX(0);
          transform-origin: left;
          transition: transform 0.4s ease;
        }

        .submit-btn:hover::after {
          transform: scaleX(1);
        }

        .btn-content {
          position: relative;
          z-index: 2;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
        }

        .btn-arrow {
          transition: transform 0.3s ease;
        }

        .submit-btn:hover .btn-arrow {
          transform: translateX(6px);
        }

        .form-footer {
          margin-top: 2.5rem;
          padding-top: 1.25rem;
          border-top: 1px solid #e2e8f0;
          display: flex;
          align-items: center;
          justify-content: space-between;
          font-size: 0.75rem;
          opacity: 0;
          animation: fadeIn 0.6s 1.4s ease-out forwards;
        }

        .help-text {
          color: #64748b;
        }

        .help-text a {
          color: #0f1f4c;
          font-weight: 700;
          text-decoration: none;
          transition: color 0.2s;
        }

        .help-text a:hover {
          color: #c49a1a;
        }

        .ssl {
          display: flex;
          align-items: center;
          gap: 6px;
          color: #94a3b8;
          font-weight: 600;
        }

        .error-banner {
          background: #fef2f2;
          border: 1px solid #fecaca;
          color: #b91c1c;
          padding: 12px 16px;
          border-radius: 12px;
          font-size: 0.875rem;
          margin-top: 1rem;
          display: none;
          animation: slideRight 0.4s ease-out;
          align-items: center;
          gap: 8px;
        }

        .error-banner.show {
          display: flex;
        }

        .demo-note {
          color: #64748b;
          font-size: 0.8125rem;
          line-height: 1.6;
          margin-top: 0.5rem;
        }

        .spinner {
          width: 16px;
          height: 16px;
          border: 2px solid rgba(255, 255, 255, 0.35);
          border-top-color: #fff;
          border-radius: 999px;
          animation: spin 0.8s linear infinite;
        }

        @media (max-width: 1024px) {
          .left-panel {
            display: none;
          }

          .right-panel {
            width: 100%;
          }

          .mobile-brand {
            display: flex;
          }
        }

        @media (max-width: 640px) {
          .right-panel {
            padding: 1.5rem;
          }

          .form-title {
            font-size: 2.75rem;
          }

          .form-footer {
            flex-direction: column;
            align-items: flex-start;
            gap: 10px;
          }
        }

        @keyframes rotate {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }

        @keyframes panBg {
          from { background-position: 0 0; }
          to { background-position: 280px 280px; }
        }

        @keyframes floatAurora {
          0%, 100% { transform: translate(0, 0) scale(1); }
          50% { transform: translate(60px, 40px) scale(1.15); }
        }

        @keyframes shimmer {
          0%, 100% { transform: translateX(-100%); }
          50% { transform: translateX(100%); }
        }

        @keyframes slideDown {
          to { opacity: 1; transform: translateY(0); }
        }

        @keyframes slideRight {
          from { opacity: 0; transform: translateX(-20px); }
          to { opacity: 1; transform: translateX(0); }
        }

        @keyframes growLine {
          to { transform: scaleX(1); }
        }

        @keyframes wordUp {
          to { opacity: 1; transform: translateY(0); }
        }

        @keyframes underline {
          to { width: 100%; }
        }

        @keyframes fadeIn {
          to { opacity: 1; }
        }

        @keyframes dashIn {
          to { opacity: 1; transform: translateY(0) perspective(1000px) rotateX(0deg); }
        }

        @keyframes statIn {
          to { opacity: 1; transform: translateY(0); }
        }

        @keyframes rowIn {
          to { opacity: 1; transform: translateX(0); }
        }

        @keyframes floatBadge {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-4px); }
        }

        @keyframes ping {
          0% { transform: scale(1); opacity: 0.4; }
          100% { transform: scale(2.5); opacity: 0; }
        }

        @keyframes glowPulse {
          0%, 100% { box-shadow: 0 0 8px #e8b923; }
          50% { box-shadow: 0 0 20px #e8b923, 0 0 4px #f4d06a; }
        }

        @keyframes fieldIn {
          to { opacity: 1; transform: translateY(0); }
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </>
  )
}
