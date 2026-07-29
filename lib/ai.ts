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

// STRONG MODELS: For article drafting (Rotation: OpenAI 2026, Gemini 3.5, Groq 120b)
// WEIGHTED ROTATION: 50% of the time Gemini starts first, 50% - strongest GPT 2026 models
// WEIGHTED ROTATION: 50% of the time Gemini starts first, 50% - strongest GPT 2026 models
const MIXED_STRONG_GROUP: PipelineEntry[] = [
  { provider: 'google', model: 'gemini-3.5-flash',        budgetMs: 30_000 },
  { provider: 'openai', model: 'gpt-5.5-2026-04-23',      budgetMs: 35_000 },
  { provider: 'google', model: 'gemini-3.5-flash',        budgetMs: 30_000 },
  { provider: 'openai', model: 'gpt-5.4-2026-03-05',      budgetMs: 35_000 },
  { provider: 'google', model: 'gemini-3.5-flash',        budgetMs: 30_000 },
  { provider: 'openai', model: 'gpt-5.4-mini-2026-03-17', budgetMs: 25_000 },
]

// TRANSLATIONS AND BACKGROUND (Llama-Scout DEPRECATED July 17 - replaced with Qwen/Compound)
const TRANSLATION_GROUP: PipelineEntry[] = [
  { provider: 'google', model: 'gemini-3.5-flash',        budgetMs: 20_000 },
  { provider: 'groq',   model: 'groq/compound',           budgetMs: 15_000 },
  { provider: 'google', model: 'gemini-3.1-flash-lite',   budgetMs: 15_000 },
  { provider: 'groq',   model: 'qwen/qwen3.6-27b',        budgetMs: 15_000 },
]

const NANO_GROUP: PipelineEntry[] = [
  { provider: 'google', model: 'gemini-3.1-flash-lite',   budgetMs: 10_000 },
  { provider: 'groq',   model: 'groq/compound',           budgetMs: 10_000 },
  { provider: 'groq',   model: 'qwen/qwen3.6-27b',        budgetMs: 10_000 },
]

const FALLBACK_TAIL: PipelineEntry[] = [
  { provider: 'google', model: 'gemini-3.1-flash-lite',   budgetMs: 12_000 },
  { provider: 'groq',   model: 'groq/compound',           budgetMs: 10_000 },
]

function buildPipelines(seed: string): Record<AiTask, PipelineEntry[]> {
  return {
    generation:  [...rotateGroup(MIXED_STRONG_GROUP, seed), ...FALLBACK_TAIL],
    translation: [...rotateGroup(TRANSLATION_GROUP, seed),  ...FALLBACK_TAIL],
    extraction:  [...rotateGroup(NANO_GROUP, seed),         ...FALLBACK_TAIL],
    utility:     [...rotateGroup([...NANO_GROUP].reverse(), seed), ...FALLBACK_TAIL],
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

export interface GenerateAttemptResult {
  text: string
  model: string
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
        return { text, model: modelLabel(entry) }
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
      return { text, model: modelLabel(entry) }
    } catch (error) {
      if (isQuotaError(error)) setCooldown(entry, retryDelayMs(error))
      errors.push(`${entry.model}: ${getErrorMessage(error).slice(0, 100)}`)
    }
  }
  throw new Error(`All generation models failed. ${errors.join(' | ')}`)
}
