import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { createGroq } from '@ai-sdk/groq'
import { createOpenAI } from '@ai-sdk/openai'

export type AiTask = 'generation' | 'translation' | 'extraction' | 'utility'
export type Provider = 'google' | 'groq' | 'openai' | 'deepseek'

export type PipelineEntry = {
  provider: Provider
  model: string
  budgetMs?: number
}

const DEFAULT_QUOTA_COOLDOWN_MS = 2 * 60 * 1000
/**
 * In-memory, per-process cooldown tracker for rate-limited AI providers.
 *
 * ⚠️ State is NOT shared across serverless function instances or cold
 * starts — this is a best-effort, same-process optimization only, not a
 * distributed rate limiter. Don't rely on it for correctness, only for
 * reducing wasted calls within a single warm instance.
 */
const modelCooldownUntil = new Map<string, number>()

export function hashSeed(seed: string): number {
  let hash = 0
  const s = seed || 'default'
  for (let i = 0; i < s.length; i++) {
    hash = (hash * 31 + s.charCodeAt(i)) | 0
  }
  return Math.abs(hash)
}

export function rotateGroup<T>(group: T[], seed: string): T[] {
  if (group.length <= 1) return group
  const start = hashSeed(seed) % group.length
  return [...group.slice(start), ...group.slice(0, start)]
}

export async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(`${label} timeout after ${timeoutMs}ms`)), timeoutMs)
  })
  try {
    return await Promise.race([promise, timeout])
  } finally {
    if (timeoutId) clearTimeout(timeoutId)
  }
}

export async function nextWithTimeout<T>(iterator: AsyncIterator<T>, timeoutMs: number, label: string): Promise<IteratorResult<T>> {
  return withTimeout(iterator.next(), timeoutMs, label)
}

export function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function getStatusCode(error: unknown): number | undefined {
  const value = error as { statusCode?: number; status?: number }
  return value.statusCode ?? value.status
}

function getResponseBody(error: unknown): string {
  const value = error as { responseBody?: string }
  return value.responseBody ?? ''
}

export function isQuotaError(error: unknown): boolean {
  const value = error as { statusCode?: number; status?: number; data?: { error?: { status?: string } } }
  const message = `${getErrorMessage(error)} ${getResponseBody(error)}`
  return getStatusCode(value) === 429 || getStatusCode(value) === 403 || value.data?.error?.status === 'RESOURCE_EXHAUSTED' || /quota|insufficient_quota|resource_exhausted|rate.?limit|429/i.test(message)
}

export function retryDelayMs(error: unknown): number {
  const message = `${getErrorMessage(error)} ${getResponseBody(error)}`
  if (/insufficient_quota/i.test(message)) return 1000 * 60 * 60 * 24;
  const retryInSeconds = message.match(/retry(?:\s|Delay| in)*\s*(?:in\s*)?(\d+(?:\.\d+)?)s/i)
  if (retryInSeconds?.[1]) return Math.ceil(Number(retryInSeconds[1]) * 1000) + 1000
  const retryDelayJson = message.match(/"retryDelay"\s*:\s*"(\d+(?:\.\d+)?)s"/)
  if (retryDelayJson?.[1]) return Math.ceil(Number(retryDelayJson[1]) * 1000) + 1000
  return DEFAULT_QUOTA_COOLDOWN_MS
}

export function modelKey(entry: PipelineEntry): string {
  return `${entry.provider}:${entry.model}`
}

export function isCoolingDown(entry: PipelineEntry): boolean {
  const until = modelCooldownUntil.get(modelKey(entry)) ?? 0
  return Date.now() < until
}

export function setCooldown(entry: PipelineEntry, ms: number): void {
  modelCooldownUntil.set(modelKey(entry), Date.now() + ms)
}

const PROVIDER_LABELS: Record<Provider, string> = {
  google: 'Gemini',
  groq: 'Groq',
  openai: 'OpenAI',
  deepseek: 'DeepSeek',
}

export function modelLabel(entry: PipelineEntry): string {
  return `${PROVIDER_LABELS[entry.provider]} ${entry.model}`
}

// AMADO_MVP_RUNTIME_REPAIR_V1
const PROVIDER_ENV_KEYS: Record<Exclude<Provider, 'google'>, string> = {
  groq: 'GROQ_API_KEY',
  openai: 'OPENAI_API_KEY',
  deepseek: 'DEEPSEEK_API_KEY',
}

type GoogleKeySource = 'GOOGLE_GENERATIVE_AI_API_KEY' | 'GEMINI_API_KEY' | null

function googleApiKey(): { key?: string; source: GoogleKeySource } {
  const canonical = process.env.GOOGLE_GENERATIVE_AI_API_KEY?.trim()
  if (canonical) return { key: canonical, source: 'GOOGLE_GENERATIVE_AI_API_KEY' }

  const studio = process.env.GEMINI_API_KEY?.trim()
  if (studio) return { key: studio, source: 'GEMINI_API_KEY' }

  return { source: null }
}

function providerApiKey(provider: Provider): string | undefined {
  if (provider === 'google') return googleApiKey().key
  return process.env[PROVIDER_ENV_KEYS[provider]]?.trim() || undefined
}

/** Whether the given provider has an API key configured in the environment. */
export function isProviderConfigured(provider: Provider): boolean {
  return Boolean(providerApiKey(provider))
}

export function getAiRuntimeInfo(): {
  googleConfigured: boolean
  googleKeySource: GoogleKeySource
  googlePrimaryModel: string
} {
  const google = googleApiKey()
  return {
    googleConfigured: Boolean(google.key),
    googleKeySource: google.source,
    googlePrimaryModel:
      process.env.AMADO_GOOGLE_MODEL_PRIMARY?.trim() || 'gemini-3-flash-preview',
  }
}

/** Filter a pipeline down to entries whose provider is configured and not cooling down. */
export function eligiblePipeline(pipeline: PipelineEntry[]): PipelineEntry[] {
  return pipeline.filter((entry) => isProviderConfigured(entry.provider) && !isCoolingDown(entry))
}

/**
 * Construct an ai-sdk LanguageModel for a pipeline entry.
 * Google accepts both the AI SDK conventional key and Google AI Studio's
 * GEMINI_API_KEY; the key is passed explicitly so SDK defaults cannot drift.
 */
export function createModel(entry: PipelineEntry) {
  const apiKey = providerApiKey(entry.provider)
  if (!apiKey) return null
  if (entry.provider === 'google') return createGoogleGenerativeAI({ apiKey })(entry.model)
  if (entry.provider === 'groq') return createGroq({ apiKey })(entry.model)
  if (entry.provider === 'openai') return createOpenAI({ apiKey })(entry.model)
  return null
}

export async function generateDeepSeekText(entry: PipelineEntry, params: { systemPrompt: string; userPrompt: string; maxTokens?: number }, timeoutMs: number): Promise<string> {
  const apiKey = process.env.DEEPSEEK_API_KEY
  const baseUrl = process.env.DEEPSEEK_BASE_URL ?? 'https://api.deepseek.com/v1/chat/completions'
  if (!apiKey) throw new Error('Missing DEEPSEEK_API_KEY')

  const response = await withTimeout(fetch(baseUrl, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: entry.model,
      messages: [{ role: 'system', content: params.systemPrompt }, { role: 'user', content: params.userPrompt }],
      ...(params.maxTokens ? { max_tokens: params.maxTokens } : {}),
    }),
  }), timeoutMs, entry.model)

  const raw = await response.text()
  if (!response.ok) {
    const error = new Error(`DeepSeek ${response.status}: ${raw.slice(0, 500)}`);
    (error as Error & { statusCode?: number }).statusCode = response.status;
    (error as Error & { responseBody?: string }).responseBody = raw;
    throw error;
  }

  const data = JSON.parse(raw)
  return data.choices?.[0]?.message?.content?.trim() ?? ''
}
