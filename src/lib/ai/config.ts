export type AiFeature =
  | 'admin_chat'
  | 'alerts_summary'
  | 'reception_briefing'
  | 'teacher_notes'
  | 'dashboard_anomalies'

export type AiProvider = 'groq'
export type GroqKeyTarget = 'realtime' | 'analytics'

type FeatureConfig = {
  provider: AiProvider
  model: string
  keyTarget: GroqKeyTarget
}

const DEFAULT_GROQ_REALTIME_MODEL = process.env.GROQ_MODEL_REALTIME || process.env.GROQ_MODEL || 'llama-3.3-70b-versatile'
const DEFAULT_GROQ_ANALYTICS_MODEL = process.env.GROQ_MODEL_ANALYTICS || process.env.GROQ_MODEL || 'llama-3.3-70b-versatile'

export const AI_FEATURE_CONFIG: Record<AiFeature, FeatureConfig> = {
  admin_chat: {
    provider: 'groq',
    model: DEFAULT_GROQ_REALTIME_MODEL,
    keyTarget: 'realtime',
  },
  alerts_summary: {
    provider: 'groq',
    model: DEFAULT_GROQ_REALTIME_MODEL,
    keyTarget: 'realtime',
  },
  reception_briefing: {
    provider: 'groq',
    model: DEFAULT_GROQ_REALTIME_MODEL,
    keyTarget: 'realtime',
  },
  teacher_notes: {
    provider: 'groq',
    model: DEFAULT_GROQ_REALTIME_MODEL,
    keyTarget: 'realtime',
  },
  dashboard_anomalies: {
    provider: 'groq',
    model: DEFAULT_GROQ_ANALYTICS_MODEL,
    keyTarget: 'analytics',
  },
}

export function getFeatureConfig(feature: AiFeature) {
  return AI_FEATURE_CONFIG[feature]
}
