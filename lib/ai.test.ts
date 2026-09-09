import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  generateText: vi.fn(),
  streamText: vi.fn(),
  createModel: vi.fn(),
  eligiblePipeline: vi.fn((pipeline: unknown[]) => pipeline),
  setCooldown: vi.fn(),
  generateDeepSeekText: vi.fn(),
}))

vi.mock('ai', () => ({
  generateText: mocks.generateText,
  streamText: mocks.streamText,
}))

vi.mock('./ai-utils', () => ({
  createModel: mocks.createModel,
  modelLabel: (entry: { provider: string; model: string }) => `${entry.provider}:${entry.model}`,
  eligiblePipeline: mocks.eligiblePipeline,
  setCooldown: mocks.setCooldown,
  getErrorMessage: (error: unknown) => error instanceof Error ? error.message : String(error),
  isQuotaError: (error: unknown) => Boolean((error as { quota?: boolean } | null)?.quota),
  isTransientProviderError: (error: unknown) => {
    const status = (error as { statusCode?: number; status?: number } | null)?.statusCode
      ?? (error as { statusCode?: number; status?: number } | null)?.status
    return status === 408 || (typeof status === 'number' && status >= 500 && status <= 599)
      || /timeout/i.test(error instanceof Error ? error.message : String(error))
  },
  retryDelayMs: () => 120_000,
  generateDeepSeekText: mocks.generateDeepSeekText,
  TRANSIENT_PROVIDER_COOLDOWN_MS: 90_000,
}))

import { generateArticleWithFallback, generateWithFallback } from './ai'

function success(text = 'Generated text') {
  return {
    text,
    finishReason: 'stop',
    usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
  }
}

describe('AI generation reliability', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.createModel.mockImplementation((entry: { model: string }) => ({ modelId: entry.model }))
  })

  it('uses AI SDK 6 maxOutputTokens and provider-aborting timeout options', async () => {
    mocks.generateText.mockResolvedValueOnce(success())

    await generateArticleWithFallback({
      systemPrompt: 'system',
      userPrompt: 'user',
      maxOutputTokens: 777,
    })

    const options = mocks.generateText.mock.calls[0]?.[0] as Record<string, unknown>
    expect(options.maxOutputTokens).toBe(777)
    expect(options).not.toHaveProperty('maxTokens')
    expect(options.timeout).toBeTypeOf('number')
    expect(options.maxRetries).toBe(0)
  })

  it('uses SDK-native streaming timeouts with valid AI SDK 6 keys', async () => {
    mocks.streamText.mockReturnValueOnce({
      textStream: (async function* () { yield 'chunk' })(),
      finishReason: Promise.resolve('stop'),
    })

    const result = await generateWithFallback({
      systemPrompt: 'system',
      userPrompt: 'utility',
      maxOutputTokens: 123,
    })
    const chunks: string[] = []
    for await (const chunk of result.textStream) chunks.push(chunk)

    const options = mocks.streamText.mock.calls[0]?.[0] as Record<string, unknown>
    expect(options.maxOutputTokens).toBe(123)
    expect(options.timeout).toEqual({ totalMs: 18_000, stepMs: 15_000, chunkMs: 10_000 })
    expect(options.timeout).not.toHaveProperty('firstChunkMs')
    expect(chunks).toEqual(['chunk'])
  })

  it('keeps the Google fallback list in fixed quality order after a primary failure', async () => {
    mocks.generateText
      .mockRejectedValueOnce(new Error('primary failed'))
      .mockResolvedValueOnce(success())

    await generateArticleWithFallback({ systemPrompt: 'system', userPrompt: 'user' })

    const attemptedModels = mocks.createModel.mock.calls.map((call) => (call[0] as { model: string }).model)
    const primary = process.env.AMADO_GOOGLE_MODEL_PRIMARY?.trim() || 'gemini-3-flash-preview'
    const stable = ['gemini-3.7-flash', 'gemini-3.6-flash', 'gemini-3.5-flash', 'gemini-3.5-flash-lite']
      .filter((model) => model !== primary)

    expect(attemptedModels.slice(0, 2)).toEqual([primary, stable[0]])
  })

  it('puts a model on a short cooldown after a retryable 5xx failure', async () => {
    const providerError = Object.assign(new Error('upstream unavailable'), { statusCode: 503 })
    mocks.generateText
      .mockRejectedValueOnce(providerError)
      .mockResolvedValueOnce(success())

    await generateArticleWithFallback({ systemPrompt: 'system', userPrompt: 'user' })

    expect(mocks.setCooldown).toHaveBeenCalledTimes(1)
    expect(mocks.setCooldown.mock.calls[0]?.[1]).toBe(90_000)
  })

  it('fails fast on an empty content-filter response instead of retrying every model', async () => {
    mocks.generateText.mockResolvedValueOnce({ text: '', finishReason: 'content-filter', usage: null })

    await expect(generateArticleWithFallback({ systemPrompt: 'system', userPrompt: 'user' }))
      .rejects.toThrow(/content-filter/)

    expect(mocks.generateText).toHaveBeenCalledTimes(1)
  })

  it('uses the extraction pipeline budget when task=extraction', async () => {
    mocks.generateText.mockResolvedValueOnce(success('{}'))

    await generateArticleWithFallback({
      systemPrompt: 'system',
      userPrompt: 'extract',
      task: 'extraction',
      deadlineAt: Date.now() + 60_000,
    })

    const options = mocks.generateText.mock.calls[0]?.[0] as Record<string, unknown>
    expect(options.timeout).toBeLessThanOrEqual(18_000)
  })
})
