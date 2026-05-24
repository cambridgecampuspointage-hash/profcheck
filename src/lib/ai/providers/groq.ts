type GroqMessage = {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export async function generateGroqText(params: {
  model: string
  messages: GroqMessage[]
  temperature?: number
  keyTarget?: 'realtime' | 'analytics'
}) {
  const apiKey =
    params.keyTarget === 'analytics'
      ? process.env.GROQ_API_KEY_ANALYTICS || process.env.GROQ_API_KEY
      : process.env.GROQ_API_KEY_REALTIME || process.env.GROQ_API_KEY

  if (!apiKey) {
    throw new Error(
      params.keyTarget === 'analytics'
        ? 'GROQ_API_KEY_ANALYTICS manquante.'
        : 'GROQ_API_KEY_REALTIME manquante.'
    )
  }

  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: params.model,
      temperature: params.temperature ?? 0.3,
      messages: params.messages,
    }),
    cache: 'no-store',
  })

  const payload = await response.json().catch(() => null)
  if (!response.ok) {
    throw new Error(payload?.error?.message || 'Erreur Groq.')
  }

  const text = payload?.choices?.[0]?.message?.content
  if (typeof text !== 'string' || !text.trim()) {
    throw new Error('Réponse Groq vide.')
  }

  return text.trim()
}
