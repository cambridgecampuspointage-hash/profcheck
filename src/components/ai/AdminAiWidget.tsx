'use client'

import { useState } from 'react'
import { Bot, Send, Sparkles, X } from 'lucide-react'

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

export function AdminAiWidget() {
  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState('general')
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [provider, setProvider] = useState('')
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: 'assistant',
      text: 'Je peux t’aider sur le CRM, la réception, le planning et les alertes.',
    },
  ])

  const send = async () => {
    const message = input.trim()
    if (!message || loading) return

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
    <div className="ai-widget-root">
      {open ? (
        <section className="ai-widget-panel">
          <div className="ai-widget-header">
            <div>
              <div className="ai-widget-eyebrow">
                <Sparkles size={14} />
                Assistant IA
              </div>
              <div className="ai-widget-title">Cambridge Campus Copilot</div>
            </div>
            <button type="button" className="ai-widget-close" onClick={() => setOpen(false)} aria-label="Fermer l’assistant">
              <X size={16} />
            </button>
          </div>

          <div className="ai-widget-toolbar">
            <select className="input ai-widget-select" value={mode} onChange={(event) => setMode(event.target.value)}>
              {MODE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
            {provider ? <span className="ai-widget-provider">{provider}</span> : null}
          </div>

          <div className="ai-widget-messages">
            {messages.map((message, index) => (
              <div
                key={`${message.role}-${index}`}
                className={`ai-widget-bubble ${message.role === 'assistant' ? 'assistant' : 'user'}`}
              >
                <div className="ai-widget-bubble-role">{message.role === 'assistant' ? 'Assistant' : 'Vous'}</div>
                <div className="ai-widget-bubble-text">{message.text}</div>
              </div>
            ))}
            {loading ? <div className="ai-widget-thinking">Analyse en cours...</div> : null}
          </div>

          <div className="ai-widget-composer">
            <textarea
              className="input ai-widget-textarea"
              rows={3}
              placeholder="Pose une question concrète..."
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault()
                  void send()
                }
              }}
            />
            <button type="button" className="ai-widget-send" disabled={loading} onClick={() => void send()}>
              <Send size={16} />
            </button>
          </div>
        </section>
      ) : null}

      <button type="button" className="ai-widget-fab" onClick={() => setOpen((value) => !value)} aria-label="Ouvrir l’assistant IA">
        <Bot size={20} />
        <span>Assistant IA</span>
      </button>
    </div>
  )
}
