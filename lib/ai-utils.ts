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

export function modelLabel(entry: PipelineEntry): string {
  if (entry.provider === 'google') return `Gemini ${entry.model}`
  if (entry.provider === 'groq')   return `Groq ${entry.model}`
  if (entry.provider === 'openai') return `OpenAI ${entry.model}`
  return `DeepSeek ${entry.model}`
}

export function createModel(entry: PipelineEntry, googleKey?: string, groqKey?: string, openaiKey?: string) {
  if (entry.provider === 'google' && googleKey) return createGoogleGenerativeAI({ apiKey: googleKey })(entry.model)
  if (entry.provider === 'groq' && groqKey) return createGroq({ apiKey: groqKey })(entry.model)
  if (entry.provider === 'openai' && openaiKey) return createOpenAI({ apiKey: openaiKey })(entry.model)
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
