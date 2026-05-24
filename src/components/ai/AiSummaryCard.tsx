'use client'

import { useCallback, useEffect, useState } from 'react'

export function AiSummaryCard({
  title,
  subtitle,
  endpoint,
  tone = '#1d4ed8',
  autoLoad = true,
  actionLabel,
}: {
  title: string
  subtitle: string
  endpoint: string
  tone?: string
  autoLoad?: boolean
  actionLabel?: string
}) {
  const [loading, setLoading] = useState(autoLoad)
  const [error, setError] = useState<string | null>(null)
  const [text, setText] = useState('')
  const [provider, setProvider] = useState('')
  const [cached, setCached] = useState(false)

  const load = useCallback(async (force = false) => {
    setLoading(true)
    setError(null)
    try {
      const url = force ? `${endpoint}${endpoint.includes('?') ? '&' : '?'}force=1` : endpoint
      const response = await fetch(url, { cache: 'no-store' })
      const payload = await response.json()
      if (!response.ok) {
        throw new Error(payload?.error || 'Chargement impossible.')
      }
      setText(payload.text || '')
      setProvider(payload.provider ? `${payload.provider} · ${payload.model}` : '')
      setCached(Boolean(payload.cached))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur IA.')
    } finally {
      setLoading(false)
    }
  }, [endpoint])

  useEffect(() => {
    if (!autoLoad) {
      return
    }

    const timeoutId = window.setTimeout(() => {
      void load()
    }, 0)

    return () => window.clearTimeout(timeoutId)
  }, [autoLoad, load])

  return (
    <section className="card" style={{ display: 'grid', gap: '0.9rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <div>
          <h2 style={{ fontSize: '1.05rem', fontWeight: 800, color: tone, marginBottom: 4 }}>{title}</h2>
          <p style={{ color: '#64748b', fontSize: '0.9rem' }}>{subtitle}</p>
        </div>
        <button type="button" className="btn btn-secondary btn-sm" onClick={() => void load(true)}>
          {actionLabel || (text ? 'Régénérer' : 'Générer')}
        </button>
      </div>

      {loading ? <div style={{ color: '#64748b' }}>Analyse IA en cours...</div> : null}
      {error ? <div style={{ color: '#b91c1c' }}>{error}</div> : null}
      {!loading && !error && !text && !autoLoad ? (
        <div style={{ color: '#64748b' }}>Génère la synthèse quand tu en as besoin.</div>
      ) : null}
      {!loading && !error && text ? (
        <>
          <div style={{ whiteSpace: 'pre-wrap', color: '#334155', lineHeight: 1.65 }}>{text}</div>
          {provider ? (
            <div style={{ color: '#94a3b8', fontSize: '0.8rem' }}>
              {provider}{cached ? ' · cache 5 min' : ''}
            </div>
          ) : null}
        </>
      ) : null}
    </section>
  )
}
