export async function generateGeminiText(params: {
  model: string
  system: string
  prompt: string
  temperature?: number
}) {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY manquante.')
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${params.model}:generateContent?key=${apiKey}`
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      system_instruction: {
        parts: [{ text: params.system }],
      },
      generationConfig: {
        temperature: params.temperature ?? 0.3,
      },
      contents: [
        {
          role: 'user',
          parts: [{ text: params.prompt }],
        },
      ],
    }),
    cache: 'no-store',
  })

  const payload = await response.json().catch(() => null)
  if (!response.ok) {
    throw new Error(payload?.error?.message || 'Erreur Gemini.')
  }

  const text = payload?.candidates?.[0]?.content?.parts
    ?.map((part: { text?: string }) => part?.text || '')
    .join('\n')
    .trim()

  if (!text) {
    throw new Error('Réponse Gemini vide.')
  }

  return text
}
