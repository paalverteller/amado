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

const PROVIDER_ENV_KEYS: Record<Provider, string> = {
  google: 'GOOGLE_GENERATIVE_AI_API_KEY',
  groq: 'GROQ_API_KEY',
  openai: 'OPENAI_API_KEY',
  deepseek: 'DEEPSEEK_API_KEY',
}

/** Whether the given provider has an API key configured in the environment. */
export function isProviderConfigured(provider: Provider): boolean {
  return Boolean(process.env[PROVIDER_ENV_KEYS[provider]])
}

/** Filter a pipeline down to entries whose provider is configured and not cooling down. */
export function eligiblePipeline(pipeline: PipelineEntry[]): PipelineEntry[] {
  return pipeline.filter((entry) => isProviderConfigured(entry.provider) && !isCoolingDown(entry))
}

/**
 * Construct an ai-sdk LanguageModel for a pipeline entry using whichever
 * provider key is configured in the environment. Returns null for providers
 * not backed by the ai-sdk (e.g. deepseek, handled via generateDeepSeekText).
 * Adding a new ai-sdk provider only requires adding one entry to
 * PROVIDER_ENV_KEYS/PROVIDER_LABELS plus one line here.
 */
export function createModel(entry: PipelineEntry) {
  const apiKey = process.env[PROVIDER_ENV_KEYS[entry.provider]]
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
