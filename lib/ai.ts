import { streamText, generateText, Output } from 'ai'
import type { ZodType } from 'zod'
import { cleanPlainTextOutput } from '@/lib/text-cleanup'
import {
  type AiTask, type PipelineEntry, createModel, modelLabel, eligiblePipeline,
  setCooldown, getErrorMessage, isQuotaError, isTransientProviderError, retryDelayMs,
  generateDeepSeekText, TRANSIENT_PROVIDER_COOLDOWN_MS,
} from './ai-utils'

const MODEL_FIRST_CHUNK_TIMEOUT_MS = 15_000
const MODEL_CHUNK_TIMEOUT_MS = 10_000
const DEFAULT_OPERATION_DEADLINE_MS = 52_000
const MIN_GENERATION_ATTEMPT_MS = 12_000
const MIN_OTHER_ATTEMPT_MS = 5_000

// ─── Pipeline Groups ─────────────────────────────────────────────────────────
// AMADO_MVP_GOOGLE_PIPELINE_V1
//
// Google AI Studio is the MVP provider. Model fallback is deliberate and
// quality-ordered: preview alias requested by product owner -> newest stable
// Flash -> older stable Flash -> Flash-Lite recovery. Do not rotate this list:
// during a primary outage, rotation silently promotes lower-quality models.
//
// Provider adapters for Groq/OpenAI/DeepSeek remain in ai-utils.ts, but they
// are intentionally not part of the default production pipeline today.

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

function googlePipeline(primaryBudgetMs: number): PipelineEntry[] {
  return uniquePipeline([
    { provider: 'google', model: GOOGLE_PRIMARY_MODEL, budgetMs: primaryBudgetMs },
    ...GOOGLE_STABLE_FALLBACKS,
  ])
}

function buildPipelines(): Record<AiTask, PipelineEntry[]> {
  return {
    generation: googlePipeline(32_000),
    translation: googlePipeline(22_000),
    extraction: googlePipeline(18_000),
    utility: googlePipeline(18_000),
  }
}

// ─── Interfaces & Streams ────────────────────────────────────────────────────

export interface GenerateParams {
  systemPrompt: string
  userPrompt: string
  maxOutputTokens?: number
  task?: AiTask
  /** Absolute epoch-ms deadline shared by all AI calls in one request. */
  deadlineAt?: number
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

export interface GenerateObjectParams<T> extends GenerateParams {
  schema: ZodType<T>
  schemaName?: string
  schemaDescription?: string
}

export interface GenerateObjectResult<T> {
  object: T
  model: string
  usage: TokenUsage | null
}

class NonRetryableGenerationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'NonRetryableGenerationError'
  }
}

async function* streamFromText(text: string): AsyncIterable<string> { yield text }

async function* streamFromProbedIterator(
  firstChunk: IteratorResult<string>,
  iterator: AsyncIterator<string>,
): AsyncIterable<string> {
  if (!firstChunk.done) yield firstChunk.value
  else return
  while (true) {
    const next = await iterator.next()
    if (next.done) return
    yield next.value
  }
}

function operationDeadline(params: GenerateParams): number {
  const operationCap = Date.now() + DEFAULT_OPERATION_DEADLINE_MS
  return params.deadlineAt ? Math.min(params.deadlineAt, operationCap) : operationCap
}

function remainingMs(deadlineAt: number): number {
  return Math.max(0, deadlineAt - Date.now())
}

function recordFailureCooldown(entry: PipelineEntry, error: unknown): void {
  if (isQuotaError(error)) {
    setCooldown(entry, retryDelayMs(error))
    return
  }
  if (isTransientProviderError(error)) {
    setCooldown(entry, TRANSIENT_PROVIDER_COOLDOWN_MS)
  }
}

function assertRetryableFinishReason(
  finishReason: string | undefined,
  text: string,
  label: string,
): void {
  if (text) return
  if (finishReason === 'content-filter') {
    throw new NonRetryableGenerationError(`${label} blocked the prompt (content-filter)`)
  }
  if (finishReason === 'error') {
    throw new Error(`${label} finished with provider error and no text`)
  }
}

// ─── Task: Utility / Translation (Streamed Fallback) ──────────────────────────

export async function generateWithFallback(params: GenerateParams): Promise<GenerateResult> {
  const task = params.task ?? 'utility'
  const pipeline = buildPipelines()[task]
  const deadlineAt = operationDeadline(params)
  const errors: string[] = []
  const eligible = eligiblePipeline(pipeline)

  if (eligible.length === 0) {
    throw new Error(`No configured ${task} models are currently eligible (missing credentials or cooldown).`)
  }

  for (const entry of eligible) {
    const remaining = remainingMs(deadlineAt)
    if (remaining < MIN_OTHER_ATTEMPT_MS) {
      errors.push(`${entry.model}: skipped, request deadline reached`)
      break
    }

    const timeoutMs = Math.min(entry.budgetMs ?? 15_000, remaining)

    try {
      const label = modelLabel(entry)
      if (entry.provider === 'deepseek') {
        const text = await generateDeepSeekText(entry, params, timeoutMs)
        if (!text) throw new Error('Empty text')
        return { model: label, textStream: streamFromText(text) }
      }

      const model = createModel(entry)
      if (!model) continue

      // AI SDK 6 owns the abort timers here. Unlike the old Promise.race
      // wrapper, these timeouts cancel the underlying provider request.
      const result = streamText({
        model,
        system: params.systemPrompt,
        prompt: params.userPrompt,
        maxRetries: 0,
        ...(params.maxOutputTokens ? { maxOutputTokens: params.maxOutputTokens } : {}),
        timeout: {
          totalMs: timeoutMs,
          stepMs: Math.min(MODEL_FIRST_CHUNK_TIMEOUT_MS, timeoutMs),
          chunkMs: Math.min(MODEL_CHUNK_TIMEOUT_MS, timeoutMs),
        },
      })
      const iterator = result.textStream[Symbol.asyncIterator]()
      const firstChunk = await iterator.next()

      if (firstChunk.done) {
        const finishReason = await result.finishReason
        assertRetryableFinishReason(finishReason, '', label)
        throw new Error('Empty text')
      }

      console.info(`[ai pipeline:${task}] SUCCESS using ${label}`)
      return { model: label, textStream: streamFromProbedIterator(firstChunk, iterator) }
    } catch (error) {
      if (error instanceof NonRetryableGenerationError) throw error
      recordFailureCooldown(entry, error)
      errors.push(`${entry.model}: ${getErrorMessage(error).slice(0, 100)}`)
    }
  }
  throw new Error(`All ${task} models failed: ${errors.join(' | ')}`)
}

// ─── Task: Generation / Extraction (Non-streamed Fallback) ───────────────────

export async function generateArticleWithFallback(params: GenerateParams): Promise<GenerateAttemptResult> {
  const task = params.task ?? 'generation'
  const pipeline = buildPipelines()[task]
  const errors: string[] = []
  const deadlineAt = operationDeadline(params)
  const minAttemptMs = task === 'generation' ? MIN_GENERATION_ATTEMPT_MS : MIN_OTHER_ATTEMPT_MS
  const eligible = eligiblePipeline(pipeline)

  if (eligible.length === 0) {
    throw new Error(`No configured ${task} models are currently eligible (missing credentials or cooldown).`)
  }

  for (const entry of eligible) {
    const remaining = remainingMs(deadlineAt)
    if (remaining < minAttemptMs) {
      errors.push(`${entry.model}: skipped, request deadline reached`)
      break
    }

    const timeoutMs = Math.min(entry.budgetMs ?? 15_000, remaining)

    try {
      console.info(`[${task} pipeline] trying ${entry.model} (budget ${timeoutMs}ms, remaining ${remaining}ms)`)
      if (entry.provider === 'deepseek') {
        const rawText = await generateDeepSeekText(entry, params, timeoutMs)
        const text = cleanPlainTextOutput(rawText)
        if (!text) throw new Error('Empty text')
        console.info(`[${task} pipeline] SUCCESS using ${entry.model}`)
        return { text, model: modelLabel(entry), usage: null }
      }

      const model = createModel(entry)
      if (!model) continue

      const result = await generateText({
        model,
        system: params.systemPrompt,
        prompt: params.userPrompt,
        maxRetries: 0,
        ...(params.maxOutputTokens ? { maxOutputTokens: params.maxOutputTokens } : {}),
        timeout: timeoutMs,
      })

      const text = cleanPlainTextOutput(result.text)
      assertRetryableFinishReason(result.finishReason, text, modelLabel(entry))
      if (!text) throw new Error('Empty text')

      console.info(`[${task} pipeline] SUCCESS using ${entry.model}`)
      const usage: TokenUsage | null = result.usage ? {
        promptTokens: result.usage.inputTokens ?? null,
        completionTokens: result.usage.outputTokens ?? null,
        totalTokens: result.usage.totalTokens ?? null,
      } : null
      return { text, model: modelLabel(entry), usage }
    } catch (error) {
      if (error instanceof NonRetryableGenerationError) throw error
      recordFailureCooldown(entry, error)
      errors.push(`${entry.model}: ${getErrorMessage(error).slice(0, 100)}`)
    }
  }
  throw new Error(`All ${task} models failed. ${errors.join(' | ')}`)
}


// ─── Task: Structured Extraction (Schema-validated Fallback) ────────────────

/**
 * Structured-output companion to generateArticleWithFallback. It preserves the
 * same provider ordering, deadline budget and cooldown behavior while letting
 * AI SDK 6 `Output.object()` validate the generated object against a Zod schema
 * before it reaches application code. The current production pipeline is
 * Google-only, so the raw-HTTP DeepSeek adapter is intentionally skipped for
 * structured output.
 */
export async function generateObjectWithFallback<T>(params: GenerateObjectParams<T>): Promise<GenerateObjectResult<T>> {
  const task = params.task ?? 'extraction'
  const pipeline = buildPipelines()[task]
  const errors: string[] = []
  const deadlineAt = operationDeadline(params)
  const minAttemptMs = task === 'generation' ? MIN_GENERATION_ATTEMPT_MS : MIN_OTHER_ATTEMPT_MS
  const eligible = eligiblePipeline(pipeline)

  if (eligible.length === 0) {
    throw new Error(`No configured ${task} models are currently eligible (missing credentials or cooldown).`)
  }

  for (const entry of eligible) {
    const remaining = remainingMs(deadlineAt)
    if (remaining < minAttemptMs) {
      errors.push(`${entry.model}: skipped, request deadline reached`)
      break
    }

    const timeoutMs = Math.min(entry.budgetMs ?? 15_000, remaining)

    try {
      if (entry.provider === 'deepseek') {
        errors.push(`${entry.model}: structured output is unavailable for the raw DeepSeek adapter`)
        continue
      }

      const model = createModel(entry)
      if (!model) continue

      console.info(`[${task} object pipeline] trying ${entry.model} (budget ${timeoutMs}ms, remaining ${remaining}ms)`)
      const result = await generateText({
        model,
        system: params.systemPrompt,
        prompt: params.userPrompt,
        output: Output.object({
          schema: params.schema,
          ...(params.schemaName ? { name: params.schemaName } : {}),
          ...(params.schemaDescription ? { description: params.schemaDescription } : {}),
        }),
        maxRetries: 0,
        ...(params.maxOutputTokens ? { maxOutputTokens: params.maxOutputTokens } : {}),
        timeout: timeoutMs,
      })

      if (result.finishReason === 'content-filter') {
        throw new NonRetryableGenerationError(`${modelLabel(entry)} blocked the prompt (content-filter)`)
      }

      console.info(`[${task} object pipeline] SUCCESS using ${entry.model}`)
      const usage: TokenUsage | null = result.usage ? {
        promptTokens: result.usage.inputTokens ?? null,
        completionTokens: result.usage.outputTokens ?? null,
        totalTokens: result.usage.totalTokens ?? null,
      } : null
      return { object: result.output as T, model: modelLabel(entry), usage }
    } catch (error) {
      if (error instanceof NonRetryableGenerationError) throw error
      recordFailureCooldown(entry, error)
      errors.push(`${entry.model}: ${getErrorMessage(error).slice(0, 100)}`)
    }
  }

  throw new Error(`All ${task} structured-output models failed. ${errors.join(' | ')}`)
}
