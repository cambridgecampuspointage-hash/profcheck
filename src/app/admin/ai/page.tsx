'use client'

import { useState } from 'react'

type ChatMessage = {
  role: 'user' | 'assistant'
  text: string
}

const MODE_OPTIONS = [
  { value: 'general', label: 'Général' },
  { value: 'crm', label: 'CRM' },
  { value: 'reception', label: 'Réception' },
  { value: 'planning', label: 'Planning' },
]

export default function AdminAiPage() {
  const [mode, setMode] = useState('general')
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: 'assistant',
      text: 'Je peux t’aider sur le CRM, la réception, le planning et les alertes. Pose une question concrète.',
    },
  ])
  const [provider, setProvider] = useState('')

  const send = async () => {
    const message = input.trim()
    if (!message) return

    setMessages((current) => [...current, { role: 'user', text: message }])
    setInput('')
    setLoading(true)

    try {
      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ mode, message }),
      })
      const payload = await response.json()
      if (!response.ok) {
        throw new Error(payload?.error || 'Erreur IA.')
      }

      setMessages((current) => [...current, { role: 'assistant', text: payload.text || '' }])
      setProvider(payload.provider ? `${payload.provider} · ${payload.model}` : '')
    } catch (error) {
      setMessages((current) => [
        ...current,
        {
          role: 'assistant',
          text: error instanceof Error ? error.message : 'Erreur IA.',
        },
      ])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ display: 'grid', gap: '1rem' }}>
      <div>
        <h1 style={{ fontSize: '1.55rem', fontWeight: 800, marginBottom: 4 }}>Assistant IA</h1>
        <p style={{ color: '#64748b' }}>Chat admin rapide pour le CRM, les alertes, la réception et le planning.</p>
      </div>

      <div className="card" style={{ display: 'grid', gap: '1rem' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr auto', gap: '0.75rem', alignItems: 'end' }}>
          <select className="input" value={mode} onChange={(event) => setMode(event.target.value)}>
            {MODE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
          <input
            className="input"
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder="Ex: Quels sont les leads prioritaires aujourd’hui ?"
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault()
                void send()
              }
            }}
          />
          <button type="button" className="btn btn-primary" disabled={loading} onClick={() => void send()}>
            {loading ? 'Envoi...' : 'Envoyer'}
          </button>
        </div>

        <div style={{ display: 'grid', gap: '0.75rem' }}>
          {messages.map((message, index) => (
            <div
              key={`${message.role}-${index}`}
              style={{
                border: '1px solid #e2e8f0',
                borderRadius: 16,
                padding: '0.9rem 1rem',
                background: message.role === 'assistant' ? '#f8fafc' : '#eff6ff',
              }}
            >
              <div style={{ fontSize: '0.78rem', fontWeight: 800, color: message.role === 'assistant' ? '#475569' : '#1d4ed8', marginBottom: 6 }}>
                {message.role === 'assistant' ? 'Assistant IA' : 'Admin'}
              </div>
              <div style={{ whiteSpace: 'pre-wrap', color: '#0f172a', lineHeight: 1.65 }}>{message.text}</div>
            </div>
          ))}
        </div>

        {provider ? <div style={{ color: '#94a3b8', fontSize: '0.8rem' }}>{provider}</div> : null}
      </div>
    </div>
  )
}
