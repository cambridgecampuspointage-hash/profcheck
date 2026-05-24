import { createAdminClient } from '@/lib/supabase/admin'
import { getFeatureConfig, type AiFeature } from './config'
import { generateGroqText } from './providers/groq'

export async function generateAiText(params: {
  feature: AiFeature
  system: string
  prompt: string
  promptSummary?: string
  referenceType?: string
  referenceId?: string
  createdBy?: string | null
  cacheMaxMinutes?: number
  force?: boolean
}) {
  const featureConfig = getFeatureConfig(params.feature)
  const provider = featureConfig.provider
  const model = featureConfig.model
  const admin = createAdminClient()

  if (!params.force && params.cacheMaxMinutes && params.referenceType && params.referenceId) {
    const cutoff = new Date(Date.now() - params.cacheMaxMinutes * 60 * 1000).toISOString()
    const { data: cached } = await admin
      .from('ai_generations')
      .select('provider, model, response_text, created_at')
      .eq('feature', params.feature)
      .eq('reference_type', params.referenceType)
      .eq('reference_id', params.referenceId)
      .gte('created_at', cutoff)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (cached?.response_text) {
      return {
        provider: cached.provider,
        model: cached.model,
        text: cached.response_text,
        cached: true,
      }
    }
  }

  const text = await generateGroqText({
    model,
    keyTarget: featureConfig.keyTarget,
    messages: [
      { role: 'system', content: params.system },
      { role: 'user', content: params.prompt },
    ],
  })

  try {
    await admin.from('ai_generations').insert({
      feature: params.feature,
      provider,
      model,
      reference_type: params.referenceType || null,
      reference_id: params.referenceId || null,
      prompt_summary: params.promptSummary || null,
      response_text: text,
      created_by: params.createdBy || null,
    })
  } catch (error) {
    console.error('ai_generations log failed', error)
  }

  return {
    provider,
    model,
    text,
    cached: false,
  }
}
