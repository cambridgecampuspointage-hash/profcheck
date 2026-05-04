'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Mail, ArrowLeft, CheckCircle, AlertCircle } from 'lucide-react'
import Link from 'next/link'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')
  const supabase = createClient()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback?next=/teacher/profile`,
    })

    if (resetError) {
      setError('Erreur lors de l\'envoi. Veuillez réessayer.')
      setLoading(false)
      return
    }

    setSent(true)
    setLoading(false)
  }

  return (
    <div className="login-page">
      <div className="login-container">
        <div className="login-header">
          <h1 className="login-title" style={{ fontSize: '1.5rem' }}>Mot de passe oublié</h1>
          <p className="login-subtitle">
            Entrez votre email pour recevoir un lien de réinitialisation.
          </p>
        </div>

        {sent ? (
          <div style={{ textAlign: 'center' }}>
            <div style={{
              width: 64, height: 64, borderRadius: '50%', background: '#d1fae5',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 1rem'
            }}>
              <CheckCircle size={32} color="#10b981" />
            </div>
            <p style={{ color: '#374151', fontWeight: 500, marginBottom: '0.5rem' }}>
              Email envoyé !
            </p>
            <p style={{ color: '#64748b', fontSize: '0.875rem', marginBottom: '1.5rem' }}>
              Vérifiez votre boîte de réception pour le lien de réinitialisation.
            </p>
            <Link href="/login" className="btn btn-secondary" style={{ display: 'inline-flex' }}>
              <ArrowLeft size={16} />
              Retour à la connexion
            </Link>
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
              <label htmlFor="email" className="form-label">Adresse email</label>
              <input
                id="email"
                type="email"
                className="input"
                placeholder="professeur@exemple.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <button type="submit" className="btn btn-primary btn-lg" disabled={loading}>
              {loading ? (
                <>
                  <div className="spinner" />
                  Envoi...
                </>
              ) : (
                <>
                  <Mail size={18} />
                  Envoyer le lien
                </>
              )}
            </button>

            <Link href="/login" className="forgot-link">
              <ArrowLeft size={14} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} />
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
