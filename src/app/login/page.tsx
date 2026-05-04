'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { Eye, EyeOff, AlertCircle, ArrowRight } from 'lucide-react'
import Link from 'next/link'
import Image from 'next/image'

export default function LoginPage() {
  const demoEnabled = process.env.NEXT_PUBLIC_ENABLE_DEMO_LOGIN === 'true'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const router = useRouter()
  const supabase = createClient()

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
      <div className="login-page">
        <div className="login-left">
          <div className="brand-wrap">
            <Image
              src="/cambridge_campus_rabat_logo.png"
              alt="Cambridge Campus Rabat"
              className="brand-logo"
              width={56}
              height={56}
            />
            <div className="brand-text">
              Cambridge Campus
              <span>Practice Makes Perfect</span>
            </div>
          </div>

          <h1 className="heading">Bon retour</h1>
          <p className="subheading">
            Connectez-vous pour acceder a votre portail de pointage.
          </p>

          <form className="form" onSubmit={handleLogin}>
            <div className="field">
              <label className="label" htmlFor="email">Adresse email</label>
              <div className="input-wrap">
                <input
                  id="email"
                  className="input"
                  type="email"
                  placeholder="vous@exemple.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                />
              </div>
            </div>

            <div className="field">
              <label className="label" htmlFor="password">Mot de passe</label>
              <div className="input-wrap">
                <input
                  id="password"
                  className="input has-icon"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  className="eye-btn"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <div className="forgot-row">
              <Link href="/forgot-password" className="forgot">
                Mot de passe oublie ?
              </Link>
            </div>

            {error && (
              <div className="error-msg">
                <AlertCircle size={16} />
                {error}
              </div>
            )}

            <button type="submit" className="btn-submit" disabled={loading}>
              {loading ? (
                <>
                  <span className="spinner" />
                  Connexion...
                </>
              ) : (
                <>
                  <ArrowRight size={18} />
                  Se connecter
                </>
              )}
            </button>

            {demoEnabled && (
              <p className="demo-note">
                Mode demo actif: utilisez les comptes admin, teacher ou reception preconfigures.
              </p>
            )}
          </form>

          <p className="login-footer">
            © {new Date().getFullYear()} ProfCheck · Tous droits reserves
          </p>
        </div>

        <div className="login-right">
          <div className="deco-circle deco-c1" />
          <div className="deco-circle deco-c2" />
          <div className="deco-circle deco-c3" />

          <div className="right-content">
            <div className="badge">
              <span className="badge-dot" />
              Portail intelligent
            </div>

            <Image
              src="/cambridge_campus_rabat_logo.png"
              alt="Cambridge Campus"
              className="right-logo"
              width={110}
              height={110}
            />

            <h2 className="right-heading">
              Un pointage plus simple, plus <em>fiable</em>
            </h2>
            <p className="right-sub">
              Gere les presences, les salles, les sessions et les rapports dans une interface elegante
              concue pour l&apos;accueil, les professeurs et l&apos;administration.
            </p>

            <div className="stats">
              <div className="stat">
                <span className="stat-num">3</span>
                <span className="stat-label">Roles</span>
              </div>
              <div className="stat">
                <span className="stat-num">20s</span>
                <span className="stat-label">QR dynamique</span>
              </div>
              <div className="stat">
                <span className="stat-num">GPS</span>
                <span className="stat-label">Verification</span>
              </div>
            </div>

            <p className="tagline">Cambridge Campus · Rabat</p>
          </div>
        </div>
      </div>

      <style jsx>{`
        :global(*) {
          box-sizing: border-box;
        }

        .login-page {
          min-height: 100vh;
          display: flex;
          font-family: Georgia, 'Times New Roman', serif;
          background: #faf8f3;
        }

        .login-left {
          width: 50%;
          display: flex;
          flex-direction: column;
          justify-content: center;
          padding: 60px 64px;
          position: relative;
          overflow: hidden;
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        }

        .login-left::before {
          content: '';
          position: absolute;
          top: -120px;
          right: -120px;
          width: 340px;
          height: 340px;
          border-radius: 50%;
          background: radial-gradient(circle, rgba(201, 168, 76, 0.12) 0%, transparent 70%);
          pointer-events: none;
        }

        .login-left::after {
          content: '';
          position: absolute;
          bottom: -80px;
          left: -80px;
          width: 260px;
          height: 260px;
          border-radius: 50%;
          background: radial-gradient(circle, rgba(27, 45, 91, 0.07) 0%, transparent 70%);
          pointer-events: none;
        }

        .brand-wrap {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 52px;
          position: relative;
          z-index: 1;
        }

        .brand-logo {
          width: 56px;
          height: 56px;
          object-fit: contain;
          border-radius: 50%;
        }

        .brand-text {
          font-family: Georgia, 'Times New Roman', serif;
          font-size: 1.15rem;
          font-weight: 700;
          color: #1b2d5b;
          line-height: 1.2;
        }

        .brand-text span {
          display: block;
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          font-size: 0.7rem;
          font-weight: 500;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: #c9a84c;
          margin-top: 1px;
        }

        .heading {
          font-family: Georgia, 'Times New Roman', serif;
          font-size: 2.6rem;
          font-weight: 700;
          color: #1b2d5b;
          line-height: 1.2;
          margin-bottom: 10px;
          position: relative;
          z-index: 1;
        }

        .subheading {
          font-size: 0.95rem;
          color: #8a8070;
          font-weight: 400;
          margin-bottom: 40px;
          position: relative;
          z-index: 1;
        }

        .form {
          display: flex;
          flex-direction: column;
          gap: 20px;
          position: relative;
          z-index: 1;
        }

        .field {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .label {
          font-size: 0.78rem;
          font-weight: 700;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          color: #1b2d5b;
        }

        .input-wrap {
          position: relative;
        }

        .input {
          width: 100%;
          padding: 14px 18px;
          border: 1.5px solid #e8e2d5;
          border-radius: 12px;
          font-size: 0.95rem;
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          color: #1b2d5b;
          background: #ffffff;
          outline: none;
          transition: border-color 0.2s, box-shadow 0.2s;
        }

        .input::placeholder {
          color: #c2baa8;
        }

        .input:focus {
          border-color: #c9a84c;
          box-shadow: 0 0 0 3px rgba(201, 168, 76, 0.12);
        }

        .input.has-icon {
          padding-right: 48px;
        }

        .eye-btn {
          position: absolute;
          right: 14px;
          top: 50%;
          transform: translateY(-50%);
          background: none;
          border: none;
          cursor: pointer;
          padding: 4px;
          color: #8a8070;
          display: flex;
          align-items: center;
          transition: color 0.2s;
        }

        .eye-btn:hover {
          color: #1b2d5b;
        }

        .forgot-row {
          display: flex;
          justify-content: flex-end;
          margin-top: -8px;
        }

        .forgot {
          font-size: 0.82rem;
          color: #c9a84c;
          text-decoration: none;
          font-weight: 700;
          transition: opacity 0.2s;
        }

        .forgot:hover {
          opacity: 0.7;
        }

        .error-msg {
          background: #fef2f2;
          border: 1px solid #fecaca;
          color: #c0392b;
          border-radius: 10px;
          padding: 11px 14px;
          font-size: 0.875rem;
          display: flex;
          align-items: center;
          gap: 8px;
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        }

        .btn-submit {
          width: 100%;
          padding: 15px;
          background: #1b2d5b;
          color: #fff;
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          font-size: 0.95rem;
          font-weight: 700;
          letter-spacing: 0.04em;
          border: none;
          border-radius: 12px;
          cursor: pointer;
          position: relative;
          overflow: hidden;
          transition: background 0.25s, transform 0.15s, box-shadow 0.25s;
          margin-top: 4px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 0.5rem;
        }

        .btn-submit::after {
          content: '';
          position: absolute;
          inset: 0;
          background: linear-gradient(120deg, transparent 30%, rgba(255, 255, 255, 0.08) 50%, transparent 70%);
          transform: translateX(-100%);
          transition: transform 0.5s ease;
        }

        .btn-submit:hover::after {
          transform: translateX(100%);
        }

        .btn-submit:hover {
          background: #243570;
          box-shadow: 0 8px 24px rgba(27, 45, 91, 0.25);
          transform: translateY(-1px);
        }

        .btn-submit:disabled {
          opacity: 0.7;
          cursor: not-allowed;
          transform: none;
        }

        .spinner {
          width: 18px;
          height: 18px;
          border: 2px solid rgba(255, 255, 255, 0.35);
          border-top-color: #fff;
          border-radius: 50%;
          animation: spin 0.7s linear infinite;
          display: inline-block;
          vertical-align: middle;
        }

        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }

        .demo-note {
          text-align: center;
          font-size: 0.8rem;
          color: #8a8070;
          margin-top: 0.25rem;
        }

        .login-footer {
          text-align: center;
          color: #94a3b8;
          font-size: 0.75rem;
          margin-top: 2rem;
          position: relative;
          z-index: 1;
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        }

        .login-right {
          width: 50%;
          background: #1b2d5b;
          position: relative;
          overflow: hidden;
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: center;
          padding: 60px 48px;
        }

        .deco-circle {
          position: absolute;
          border-radius: 50%;
          pointer-events: none;
        }

        .deco-c1 {
          width: 380px;
          height: 380px;
          top: -100px;
          right: -100px;
          background: radial-gradient(circle, rgba(201, 168, 76, 0.18) 0%, transparent 65%);
        }

        .deco-c2 {
          width: 300px;
          height: 300px;
          bottom: -80px;
          left: -80px;
          background: radial-gradient(circle, rgba(201, 168, 76, 0.12) 0%, transparent 65%);
        }

        .deco-c3 {
          width: 180px;
          height: 180px;
          top: 38%;
          left: 50%;
          transform: translate(-50%, -50%);
          border: 1px solid rgba(201, 168, 76, 0.2);
        }

        .right-content {
          position: relative;
          z-index: 1;
          text-align: center;
          max-width: 400px;
        }

        .badge {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          background: rgba(201, 168, 76, 0.15);
          border: 1px solid rgba(201, 168, 76, 0.35);
          border-radius: 100px;
          padding: 7px 18px;
          font-size: 0.75rem;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          color: #c9a84c;
          font-weight: 700;
          margin-bottom: 36px;
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        }

        .badge-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: #c9a84c;
          animation: pulse 2s infinite;
        }

        @keyframes pulse {
          0%, 100% {
            opacity: 1;
            transform: scale(1);
          }
          50% {
            opacity: 0.5;
            transform: scale(0.8);
          }
        }

        .right-logo {
          width: 110px;
          height: 110px;
          object-fit: contain;
          border-radius: 50%;
          border: 3px solid rgba(201, 168, 76, 0.4);
          margin-bottom: 32px;
          filter: drop-shadow(0 8px 24px rgba(0, 0, 0, 0.35));
        }

        .right-heading {
          font-family: Georgia, 'Times New Roman', serif;
          font-size: 2.1rem;
          font-weight: 700;
          color: #fff;
          line-height: 1.25;
          margin-bottom: 16px;
        }

        .right-heading em {
          font-style: normal;
          color: #c9a84c;
        }

        .right-sub {
          font-size: 0.95rem;
          color: rgba(255, 255, 255, 0.6);
          font-weight: 400;
          line-height: 1.6;
          margin-bottom: 40px;
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        }

        .stats {
          display: flex;
          gap: 0;
          background: rgba(255, 255, 255, 0.06);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 16px;
          overflow: hidden;
          width: 100%;
        }

        .stat {
          flex: 1;
          padding: 20px 16px;
          text-align: center;
        }

        .stat + .stat {
          border-left: 1px solid rgba(255, 255, 255, 0.1);
        }

        .stat-num {
          font-family: Georgia, 'Times New Roman', serif;
          font-size: 1.6rem;
          font-weight: 700;
          color: #c9a84c;
          display: block;
          line-height: 1;
        }

        .stat-label {
          font-size: 0.72rem;
          color: rgba(255, 255, 255, 0.45);
          letter-spacing: 0.06em;
          text-transform: uppercase;
          margin-top: 6px;
          display: block;
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        }

        .tagline {
          margin-top: 28px;
          font-size: 0.8rem;
          color: rgba(255, 255, 255, 0.3);
          letter-spacing: 0.12em;
          text-transform: uppercase;
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        }

        @media (max-width: 900px) {
          .login-page {
            flex-direction: column;
          }

          .login-left,
          .login-right {
            width: 100%;
          }

          .login-left {
            padding: 40px 28px;
          }

          .login-right {
            padding: 48px 28px;
          }

          .heading {
            font-size: 2rem;
          }

          .right-heading {
            font-size: 1.7rem;
          }
        }

        @media (max-width: 480px) {
          .login-left {
            padding: 32px 20px;
          }

          .login-right {
            padding: 40px 20px;
          }

          .stats {
            flex-wrap: wrap;
          }

          .stat {
            min-width: 50%;
          }

          .stat:nth-child(3) {
            border-left: none;
            border-top: 1px solid rgba(255, 255, 255, 0.1);
          }
        }
      `}</style>
    </>
  )
}
