'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

type AlertHistoryEntry = {
  id: string
  type: string
  date: string
  sent_at: string
  sent_ok: boolean
  message: string | null
  error_message?: string | null
}

const ALERT_PREFERENCES = [
  { key: 'teacher_absent', label: 'Professeur absent' },
  { key: 'teacher_late', label: 'Professeur en retard' },
  { key: 'out_of_planning', label: 'Session hors planning' },
  { key: 'staff_late', label: 'Réceptionniste en retard' },
  { key: 'staff_absent', label: 'Réceptionniste absente' },
  { key: 'staff_long_break', label: 'Pause excessive' },
  { key: 'staff_early_leave', label: 'Départ anticipé' },
  { key: 'daily_summary', label: 'Résumé quotidien (20h00)' },
] as const

function truncateMessage(message: string | null) {
  if (!message) return '—'
  return message.length > 60 ? `${message.slice(0, 60)}…` : message
}

function formatAlertType(value: string) {
  return value
    .split('_')
    .map((chunk) => chunk.charAt(0).toUpperCase() + chunk.slice(1))
    .join(' ')
}

function readPreferences() {
  if (typeof window === 'undefined') {
    return Object.fromEntries(ALERT_PREFERENCES.map((preference) => [preference.key, true])) as Record<string, boolean>
  }

  const stored = window.localStorage.getItem('telegram_alert_preferences')
  if (!stored) {
    return Object.fromEntries(ALERT_PREFERENCES.map((preference) => [preference.key, true])) as Record<string, boolean>
  }

  try {
    return JSON.parse(stored) as Record<string, boolean>
  } catch {
    return Object.fromEntries(ALERT_PREFERENCES.map((preference) => [preference.key, true])) as Record<string, boolean>
  }
}

export default function TelegramSettingsPage() {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])
  const [authorized, setAuthorized] = useState<boolean | null>(null)
  const [configured, setConfigured] = useState<boolean | null>(null)
  const [history, setHistory] = useState<AlertHistoryEntry[]>([])
  const [preferences, setPreferences] = useState<Record<string, boolean>>(() => readPreferences())
  const [loadingTest, setLoadingTest] = useState(false)
  const [loadingHistory, setLoadingHistory] = useState(true)
  const [retryingIds, setRetryingIds] = useState<string[]>([])
  const [retryingAll, setRetryingAll] = useState(false)
  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [historyFilters, setHistoryFilters] = useState({
    type: '',
    status: '',
    dateFrom: '',
    dateTo: '',
  })

  useEffect(() => {
    let cancelled = false

    const bootstrap = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        router.replace('/login')
        return
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

      if (profile?.role !== 'admin') {
        router.replace('/dashboard')
        return
      }

      if (cancelled) return
      setAuthorized(true)

      const [statusResponse, historyResponse] = await Promise.all([
        fetch('/api/alerts/test?mode=status'),
        fetch('/api/alerts/test?mode=history'),
      ])

      const statusPayload = (await statusResponse.json()) as {
        ok: boolean
        configured?: boolean
        error?: string
      }
      const historyPayload = (await historyResponse.json()) as {
        ok: boolean
        alerts?: AlertHistoryEntry[]
        error?: string
      }

      if (cancelled) return

      if (statusPayload.ok) {
        setConfigured(Boolean(statusPayload.configured))
      } else {
        setConfigured(false)
        setErrorMessage(statusPayload.error || 'Impossible de lire la configuration Telegram.')
      }

      if (historyPayload.ok) {
        setHistory(historyPayload.alerts || [])
      } else {
        setErrorMessage(historyPayload.error || 'Impossible de charger l’historique.')
      }

      setLoadingHistory(false)
    }

    void bootstrap()

    return () => {
      cancelled = true
    }
  }, [router, supabase])

  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('telegram_alert_preferences', JSON.stringify(preferences))
    }
  }, [preferences])

  const loadHistory = async (filters = historyFilters) => {
    setLoadingHistory(true)
    const params = new URLSearchParams({ mode: 'history' })
    if (filters.type) params.set('type', filters.type)
    if (filters.status) params.set('status', filters.status)
    if (filters.dateFrom) params.set('dateFrom', filters.dateFrom)
    if (filters.dateTo) params.set('dateTo', filters.dateTo)

    const response = await fetch(`/api/alerts/test?${params.toString()}`)
    const payload = (await response.json()) as { ok: boolean; alerts?: AlertHistoryEntry[]; error?: string }
    if (payload.ok) {
      setHistory(payload.alerts || [])
    } else {
      setErrorMessage(payload.error || 'Impossible de recharger l’historique.')
    }
    setLoadingHistory(false)
  }

  const retryFailedAlerts = async (ids: string[]) => {
    if (ids.length === 0) return

    setStatusMessage(null)
    setErrorMessage(null)

    const singleRetry = ids.length === 1
    if (singleRetry) {
      setRetryingIds(ids)
    } else {
      setRetryingAll(true)
    }

    try {
      const response = await fetch('/api/alerts/test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'retry_failed',
          ids,
        }),
      })

      const payload = (await response.json()) as {
        ok: boolean
        message?: string
        error?: string
      }

      if (!payload.ok) {
        setErrorMessage(payload.error || 'Impossible de relancer les alertes.')
      } else {
        setStatusMessage(payload.message || 'Relance effectuée.')
        await loadHistory()
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Erreur réseau pendant la relance.')
    } finally {
      setRetryingIds([])
      setRetryingAll(false)
    }
  }

  const sendTestMessage = async () => {
    setLoadingTest(true)
    setStatusMessage(null)
    setErrorMessage(null)

    try {
      const response = await fetch('/api/alerts/test')
      const payload = (await response.json()) as {
        ok: boolean
        message?: string
        error?: string
      }

      if (!payload.ok) {
        setErrorMessage(payload.error || 'Impossible d’envoyer le message de test.')
      } else {
        setStatusMessage(payload.message || 'Message envoyé avec succès.')
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Erreur réseau pendant le test.')
    } finally {
      setLoadingTest(false)
    }
  }

  if (authorized === null) {
    return <PageState label="Vérification des droits administrateur..." />
  }

  const failedEntryIds = history.filter((entry) => !entry.sent_ok).map((entry) => entry.id)

  return (
    <div style={{ minHeight: '100vh', background: '#FAF8F3', padding: '2rem clamp(1rem, 2vw, 2rem)' }}>
      <div style={{ maxWidth: 1180, margin: '0 auto', display: 'grid', gap: '1.2rem' }}>
        <header style={cardStyle}>
          <h1 style={{ margin: 0, color: '#1B2D5B', fontSize: '1.9rem', fontWeight: 800 }}>
            Notifications Telegram
          </h1>
          <p style={{ margin: '0.35rem 0 0', color: '#8B7D6B' }}>
            Configurez les alertes automatiques
          </p>
        </header>

        <section style={cardStyle}>
          <div style={sectionTitleStyle}>Statut de la connexion</div>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.7rem' }}>
              <span
                style={{
                  width: 14,
                  height: 14,
                  borderRadius: '50%',
                  background: configured ? '#0F9D58' : '#E53E3E',
                  display: 'inline-block',
                }}
              />
              <span style={{ color: '#1B2D5B', fontWeight: 700 }}>
                {configured ? 'Configuré' : 'Non configuré'}
              </span>
            </div>

            <button
              type="button"
              onClick={sendTestMessage}
              disabled={loadingTest}
              style={primaryButtonStyle}
            >
              🧪 {loadingTest ? 'Envoi en cours...' : 'Envoyer un message de test'}
            </button>
          </div>

          {statusMessage ? (
            <div style={successStyle}>{statusMessage}</div>
          ) : null}
          {errorMessage ? (
            <div style={errorStyle}>{errorMessage}</div>
          ) : null}
        </section>

        {!configured ? (
          <section style={cardStyle}>
            <div style={sectionTitleStyle}>Guide de configuration</div>
            <div style={{ display: 'grid', gap: '0.85rem' }}>
              {[
                'Ouvrez Telegram et cherchez @BotFather',
                'Envoyez /newbot et suivez les instructions',
                'Copiez le token et ajoutez-le dans vos variables d’environnement',
                'Démarrez votre bot et récupérez votre Chat ID',
                'Cliquez "Tester la connexion" pour vérifier',
              ].map((step, index) => (
                <div key={step} style={{ display: 'flex', gap: '0.8rem', alignItems: 'flex-start' }}>
                  <div
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: '50%',
                      background: '#1B2D5B',
                      color: '#FFFFFF',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 800,
                      flexShrink: 0,
                    }}
                  >
                    {index + 1}
                  </div>
                  <div style={{ color: '#3D4B6D', fontWeight: 600 }}>{step}</div>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        <section style={cardStyle}>
          <div style={sectionTitleStyle}>Alertes actives</div>
          <div style={{ display: 'grid', gap: '0.8rem' }}>
            {ALERT_PREFERENCES.map((preference) => {
              const checked = preferences[preference.key] ?? true
              return (
                <label
                  key={preference.key}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: '1rem',
                    border: '1px solid #E8E2D5',
                    borderRadius: 16,
                    padding: '0.85rem 1rem',
                    background: '#FFFFFF',
                    cursor: 'pointer',
                  }}
                >
                  <span style={{ color: '#1B2D5B', fontWeight: 700 }}>{preference.label}</span>
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => {
                      setPreferences((current) => ({
                        ...current,
                        [preference.key]: !checked,
                      }))
                    }}
                  />
                </label>
              )
            })}
          </div>
        </section>

        <section style={cardStyle}>
          <div style={sectionTitleStyle}>Historique des alertes envoyées</div>

          <div style={{ display: 'grid', gap: '0.75rem', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', marginBottom: '1rem' }}>
            <select
              value={historyFilters.type}
              onChange={(event) => setHistoryFilters((current) => ({ ...current, type: event.target.value }))}
              style={filterInputStyle}
            >
              <option value="">Tous les types</option>
              {ALERT_PREFERENCES.map((preference) => (
                <option key={preference.key} value={preference.key}>{preference.label}</option>
              ))}
            </select>
            <select
              value={historyFilters.status}
              onChange={(event) => setHistoryFilters((current) => ({ ...current, status: event.target.value }))}
              style={filterInputStyle}
            >
              <option value="">Tous les statuts</option>
              <option value="sent">Envoyé</option>
              <option value="error">Erreur</option>
            </select>
            <input
              type="date"
              value={historyFilters.dateFrom}
              onChange={(event) => setHistoryFilters((current) => ({ ...current, dateFrom: event.target.value }))}
              style={filterInputStyle}
            />
            <input
              type="date"
              value={historyFilters.dateTo}
              onChange={(event) => setHistoryFilters((current) => ({ ...current, dateTo: event.target.value }))}
              style={filterInputStyle}
            />
          </div>

          {loadingHistory ? (
            <div style={{ color: '#8B7D6B' }}>Chargement de l’historique...</div>
          ) : history.length === 0 ? (
            <div style={{ color: '#8B7D6B' }}>Aucune alerte envoyée pour le moment.</div>
          ) : (
            <>
              <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
                <button
                  type="button"
                  onClick={() => void loadHistory()}
                  style={secondaryButtonStyle}
                >
                  Filtrer / recharger
                </button>
                <button
                  type="button"
                  disabled={retryingAll || failedEntryIds.length === 0}
                  onClick={() => void retryFailedAlerts(failedEntryIds)}
                  style={{
                    ...primaryButtonStyle,
                    opacity: retryingAll || failedEntryIds.length === 0 ? 0.6 : 1,
                    cursor: retryingAll || failedEntryIds.length === 0 ? 'not-allowed' : 'pointer',
                  }}
                >
                  {retryingAll ? 'Relance en cours...' : `Renvoyer les alertes en erreur (${failedEntryIds.length})`}
                </button>
              </div>

              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 760 }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid #E8E2D5' }}>
                      {['Date', 'Heure', 'Type', 'Statut', 'Message', 'Actions'].map((header) => (
                        <th key={header} style={headerStyle}>{header}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {history.map((entry) => {
                      const sentAt = new Date(entry.sent_at)
                      return (
                        <tr key={entry.id} style={{ borderBottom: '1px solid #F1ECE3' }}>
                          <td style={cellStyle}>
                            {sentAt.toLocaleDateString('fr-FR', { timeZone: 'Africa/Casablanca' })}
                          </td>
                          <td style={cellStyle}>
                            {sentAt.toLocaleTimeString('fr-FR', {
                              timeZone: 'Africa/Casablanca',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </td>
                          <td style={cellStyle}>{formatAlertType(entry.type)}</td>
                          <td style={cellStyle}>
                            <span style={{
                              display: 'inline-block',
                              padding: '0.35rem 0.65rem',
                              borderRadius: 999,
                              background: entry.sent_ok ? 'rgba(15, 157, 88, 0.12)' : 'rgba(229, 62, 62, 0.12)',
                              color: entry.sent_ok ? '#0F9D58' : '#E53E3E',
                              fontWeight: 800,
                            }}>
                              {entry.sent_ok ? 'Envoyé' : 'Erreur'}
                            </span>
                          </td>
                          <td style={cellStyle}>{truncateMessage(entry.sent_ok ? entry.message : entry.error_message || entry.message)}</td>
                          <td style={cellStyle}>
                            {!entry.sent_ok ? (
                              <button
                                type="button"
                                onClick={() => void retryFailedAlerts([entry.id])}
                                disabled={retryingAll || retryingIds.includes(entry.id)}
                                style={{
                                  ...secondaryButtonStyle,
                                  padding: '0.55rem 0.8rem',
                                  opacity: retryingAll || retryingIds.includes(entry.id) ? 0.6 : 1,
                                  cursor: retryingAll || retryingIds.includes(entry.id) ? 'not-allowed' : 'pointer',
                                }}
                              >
                                {retryingIds.includes(entry.id) ? 'Relance...' : 'Renvoyer'}
                              </button>
                            ) : (
                              <span style={{ color: '#8B7D6B', fontWeight: 600 }}>—</span>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  )
}

function PageState({ label }: { label: string }) {
  return (
    <div style={{ minHeight: '100vh', background: '#FAF8F3', display: 'grid', placeItems: 'center', color: '#8B7D6B' }}>
      {label}
    </div>
  )
}

const cardStyle: React.CSSProperties = {
  background: '#FFFFFF',
  border: '1px solid #E8E2D5',
  borderRadius: 24,
  padding: '1.2rem',
}

const sectionTitleStyle: React.CSSProperties = {
  color: '#1B2D5B',
  fontWeight: 800,
  marginBottom: '1rem',
}

const primaryButtonStyle: React.CSSProperties = {
  border: '1px solid #C9A84C',
  background: '#1B2D5B',
  color: '#FFFFFF',
  borderRadius: 14,
  padding: '0.8rem 1rem',
  fontWeight: 800,
  cursor: 'pointer',
}

const secondaryButtonStyle: React.CSSProperties = {
  border: '1px solid #E8E2D5',
  background: '#FAF8F3',
  color: '#1B2D5B',
  borderRadius: 14,
  padding: '0.8rem 1rem',
  fontWeight: 800,
  cursor: 'pointer',
}

const successStyle: React.CSSProperties = {
  marginTop: '1rem',
  background: 'rgba(15, 157, 88, 0.12)',
  border: '1px solid rgba(15, 157, 88, 0.2)',
  color: '#0F9D58',
  borderRadius: 16,
  padding: '0.85rem 1rem',
  fontWeight: 700,
}

const errorStyle: React.CSSProperties = {
  marginTop: '1rem',
  background: 'rgba(229, 62, 62, 0.12)',
  border: '1px solid rgba(229, 62, 62, 0.2)',
  color: '#E53E3E',
  borderRadius: 16,
  padding: '0.85rem 1rem',
  fontWeight: 700,
}

const headerStyle: React.CSSProperties = {
  textAlign: 'left',
  padding: '0.85rem 0.75rem',
  color: '#8B7D6B',
  fontSize: '0.78rem',
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
}

const cellStyle: React.CSSProperties = {
  padding: '0.9rem 0.75rem',
  color: '#1B2D5B',
  fontWeight: 600,
}

const filterInputStyle: React.CSSProperties = {
  border: '1px solid #E8E2D5',
  borderRadius: 14,
  padding: '0.8rem 0.9rem',
  background: '#FFFFFF',
  color: '#1B2D5B',
  fontWeight: 600,
}
