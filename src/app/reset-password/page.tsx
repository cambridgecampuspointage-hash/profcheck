'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { AlertCircle, CheckCircle, KeyRound } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

export default function ResetPasswordPage() {
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()
  const supabase = createClient()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (password.length < 8) {
      setError('Le nouveau mot de passe doit contenir au moins 8 caractères.')
      return
    }

    if (password !== confirmPassword) {
      setError('Les mots de passe ne correspondent pas.')
      return
    }

    setLoading(true)

    const { error: updateError } = await supabase.auth.updateUser({ password })

    if (updateError) {
      setError('Impossible de modifier le mot de passe. Veuillez réessayer.')
      setLoading(false)
      return
    }

    await supabase.auth.signOut()
    setSuccess(true)
    setLoading(false)

    setTimeout(() => {
      router.push('/login?reset=success')
    }, 1200)
  }

  return (
    <div className="login-page">
      <div className="login-container">
        <div className="login-header">
          <h1 className="login-title" style={{ fontSize: '1.5rem' }}>Nouveau mot de passe</h1>
          <p className="login-subtitle">
            Définissez un nouveau mot de passe pour sécuriser votre compte.
          </p>
        </div>

        {success ? (
          <div style={{ textAlign: 'center' }}>
            <div style={{
              width: 64, height: 64, borderRadius: '50%', background: '#d1fae5',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 1rem'
            }}>
              <CheckCircle size={32} color="#10b981" />
            </div>
            <p style={{ color: '#374151', fontWeight: 500, marginBottom: '0.5rem' }}>
              Mot de passe mis à jour.
            </p>
            <p style={{ color: '#64748b', fontSize: '0.875rem' }}>
              Redirection vers la connexion...
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="login-form">
            {error && (
              <div className="login-error">
                <AlertCircle size={16} />
                <span>{error}</span>
              </div>
            )}

            <div className="form-group">
              <label htmlFor="password" className="form-label">Nouveau mot de passe</label>
              <input
                id="password"
                type="password"
                className="input"
                placeholder="Minimum 8 caractères"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                autoComplete="new-password"
              />
            </div>

            <div className="form-group">
              <label htmlFor="confirmPassword" className="form-label">Confirmer le mot de passe</label>
              <input
                id="confirmPassword"
                type="password"
                className="input"
                placeholder="Confirmez le mot de passe"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={8}
                autoComplete="new-password"
              />
            </div>

            <button type="submit" className="btn btn-primary btn-lg" disabled={loading}>
              {loading ? (
                <>
                  <div className="spinner" />
                  Mise à jour...
                </>
              ) : (
                <>
                  <KeyRound size={18} />
                  Enregistrer le nouveau mot de passe
                </>
              )}
            </button>

            <Link href="/login" className="forgot-link">
              Retour à la connexion
            </Link>
          </form>
        )}
      </div>

      <style jsx>{`
        .login-page {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          padding: 1rem;
        }
        .login-container {
          width: 100%;
          max-width: 420px;
          background: white;
          border-radius: 24px;
          padding: 2.5rem 2rem;
          box-shadow: 0 25px 60px rgba(0, 0, 0, 0.2);
        }
        .login-header {
          text-align: center;
          margin-bottom: 2rem;
        }
        .login-title {
          font-weight: 800;
          color: #0f172a;
        }
        .login-subtitle {
          color: #64748b;
          font-size: 0.875rem;
          margin-top: 0.5rem;
        }
        .login-form {
          display: flex;
          flex-direction: column;
          gap: 1.25rem;
        }
        .login-error {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.75rem 1rem;
          background: #fee2e2;
          color: #dc2626;
          border-radius: 12px;
          font-size: 0.875rem;
        }
        .form-group {
          display: flex;
          flex-direction: column;
          gap: 0.375rem;
        }
        .form-label {
          font-size: 0.8125rem;
          font-weight: 600;
          color: #374151;
        }
        .forgot-link {
          text-align: center;
          color: #6366f1;
          font-size: 0.8125rem;
          font-weight: 500;
          text-decoration: none;
        }
      `}</style>
    </div>
  )
}
