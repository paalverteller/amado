import { streamText, generateText } from 'ai'
import { cleanPlainTextOutput } from '@/lib/text-cleanup'
import {
  AiTask, PipelineEntry, rotateGroup, createModel, modelLabel, eligiblePipeline,
  setCooldown, getErrorMessage, isQuotaError, retryDelayMs,
  generateDeepSeekText, withTimeout, nextWithTimeout
} from './ai-utils'

// Extended timeouts for reasoning models (o-series)
const MODEL_FIRST_CHUNK_TIMEOUT_MS = 15000
const MODEL_CHUNK_TIMEOUT_MS = 10000
const FUNCTION_DEADLINE_MS = 55_000
const SAFETY_MARGIN_MS = 3_000

// ─── Pipeline Groups ─────────────────────────────────────────────────────────
// AMADO_MVP_GOOGLE_PIPELINE_V1
//
// Google AI Studio is the MVP provider. Model fallback is deliberate:
// 1) preview alias requested by product owner,
// 2) newest stable Flash,
// 3) previous stable generations,
// 4) Flash-Lite as the final low-cost recovery path.
//
// Existing provider adapters remain in ai-utils.ts, but are not part of the
// default MVP route while only Google is configured.

const GOOGLE_PRIMARY_MODEL =
  process.env.AMADO_GOOGLE_MODEL_PRIMARY?.trim() || 'gemini-3-flash-preview'

const GOOGLE_STABLE_FALLBACKS: PipelineEntry[] = [
  { provider: 'google', model: 'gemini-3.7-flash',      budgetMs: 30_000 },
  { provider: 'google', model: 'gemini-3.6-flash',      budgetMs: 28_000 },
  { provider: 'google', model: 'gemini-3.5-flash',      budgetMs: 26_000 },
  { provider: 'google', model: 'gemini-3.5-flash-lite', budgetMs: 20_000 },
]

function uniquePipeline(entries: PipelineEntry[]): PipelineEntry[] {
  const seen = new Set<string>()
  return entries.filter((entry) => {
    const key = `${entry.provider}:${entry.model}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function googlePipeline(seed: string, primaryBudgetMs: number): PipelineEntry[] {
  return uniquePipeline([
    { provider: 'google', model: GOOGLE_PRIMARY_MODEL, budgetMs: primaryBudgetMs },
    ...rotateGroup(GOOGLE_STABLE_FALLBACKS, seed),
  ])
}

function buildPipelines(seed: string): Record<AiTask, PipelineEntry[]> {
  return {
    generation: googlePipeline(seed, 32_000),
    translation: googlePipeline(`${seed}:translation`, 22_000),
    extraction: googlePipeline(`${seed}:extraction`, 18_000),
    utility: googlePipeline(`${seed}:utility`, 18_000),
  }
}


// ─── Interfaces & Streams ────────────────────────────────────────────────────

export interface GenerateParams {
  systemPrompt: string
  userPrompt: string
  maxTokens?: number
  task?: AiTask
}

export interface GenerateResult {
  textStream: AsyncIterable<string>
  model: string
}

export interface TokenUsage {
  promptTokens: number | null
  completionTokens: number | null
  totalTokens: number | null
}

export interface GenerateAttemptResult {
  text: string
  model: string
  /** null when the provider (e.g. the DeepSeek raw-HTTP path) doesn't
   *  report usage, or when usage wasn't in the SDK response. */
  usage: TokenUsage | null
}

async function* streamFromText(text: string): AsyncIterable<string> { yield text }

async function* streamFromProbedIterator(firstChunk: IteratorResult<string>, iterator: AsyncIterator<string>, model: string): AsyncIterable<string> {
  if (!firstChunk.done) yield firstChunk.value; else return;
  while (true) {
    const next = await nextWithTimeout(iterator, MODEL_CHUNK_TIMEOUT_MS, `${model} stream chunk`)
    if (next.done) return
    yield next.value
  }
}

// ─── Task: Utility / Translation (Streamed Fallback) ──────────────────────────

export async function generateWithFallback(params: GenerateParams): Promise<GenerateResult> {
  const task = params.task ?? 'utility'

  const seed = params.userPrompt || params.systemPrompt || task
  const pipeline = buildPipelines(seed)[task]
  const errors: string[] = []

  for (const entry of eligiblePipeline(pipeline)) {
    try {
      const label = modelLabel(entry)
      if (entry.provider === 'deepseek') {
        const text = await generateDeepSeekText(entry, params, MODEL_FIRST_CHUNK_TIMEOUT_MS)
        return { model: label, textStream: streamFromText(text) }
      }
      
      const model = createModel(entry)
      if (!model) continue

      const result = streamText({ model, system: params.systemPrompt, prompt: params.userPrompt, maxRetries: 0, ...(params.maxTokens ? { maxTokens: params.maxTokens } : {}) })
      const iterator = result.textStream[Symbol.asyncIterator]()
      const firstChunk = await nextWithTimeout(iterator, MODEL_FIRST_CHUNK_TIMEOUT_MS, `${label} first chunk`)
      
      console.info(`[ai pipeline:${task}] SUCCESS using ${label}`)
      return { model: label, textStream: streamFromProbedIterator(firstChunk, iterator, label) }
    } catch (error) {
      if (isQuotaError(error)) setCooldown(entry, retryDelayMs(error))
      errors.push(`${entry.model}: ${getErrorMessage(error).slice(0, 100)}`)
    }
  }
  throw new Error(`All models failed: ${errors.join(' | ')}`)
}

// ─── Task: Generation (Article Drafting) ──────────────────────────────────────

export async function generateArticleWithFallback(params: GenerateParams): Promise<GenerateAttemptResult> {
  const pipeline = buildPipelines(params.userPrompt || 'default')['generation']
  const errors: string[] = []
  const startedAt = Date.now()

  for (const entry of eligiblePipeline(pipeline)) {
    const elapsed = Date.now() - startedAt
    const remaining = FUNCTION_DEADLINE_MS - elapsed - SAFETY_MARGIN_MS
    
   // Self-healing: if less than 5 seconds remain, don't risk calling a new model
   // to avoid Vercel silently killing the function.
    if (remaining <= 5000) {
      errors.push(`${entry.model}: skipped, deadline reached`)
      break
    }
    
   // Model time budget = min(desired budget, remaining time - buffer)
    const timeoutMs = Math.max(5000, Math.min(entry.budgetMs || 15000, remaining))

    try {
      console.info(`[generate pipeline] trying ${entry.model} (budget ${timeoutMs}ms, elapsed ${elapsed}ms)`)
      if (entry.provider === 'deepseek') {
        const rawText = await generateDeepSeekText(entry, params, timeoutMs)
        const text = cleanPlainTextOutput(rawText)
        if (!text) throw new Error(`Empty text`)
        console.info(`[generate pipeline] SUCCESS using ${entry.model}`)
        return { text, model: modelLabel(entry), usage: null }
      }

      const model = createModel(entry)
      if (!model) continue

      const result = await withTimeout(
        generateText({ model, system: params.systemPrompt, prompt: params.userPrompt, maxRetries: 0, ...(params.maxTokens ? { maxTokens: params.maxTokens } : {}) }),
        timeoutMs, entry.model
      )

      const text = cleanPlainTextOutput(result.text)
      if (!text) throw new Error(`Empty text`)
      
      console.info(`[generate pipeline] SUCCESS using ${entry.model}`)
      const usage: TokenUsage | null = result.usage ? {
        promptTokens: result.usage.inputTokens ?? null,
        completionTokens: result.usage.outputTokens ?? null,
        totalTokens: result.usage.totalTokens ?? null,
      } : null
      return { text, model: modelLabel(entry), usage }
    } catch (error) {
      if (isQuotaError(error)) setCooldown(entry, retryDelayMs(error))
      errors.push(`${entry.model}: ${getErrorMessage(error).slice(0, 100)}`)
    }
  }
  throw new Error(`All generation models failed. ${errors.join(' | ')}`)
}