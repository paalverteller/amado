import { describe, expect, it } from 'vitest'
import { isTransientProviderError } from './ai-utils'

describe('isTransientProviderError', () => {
  it('recognizes timeouts and retryable 5xx provider failures', () => {
    expect(isTransientProviderError(new Error('gemini timeout after 15000ms'))).toBe(true)
    expect(isTransientProviderError(Object.assign(new Error('upstream unavailable'), { statusCode: 503 }))).toBe(true)
    expect(isTransientProviderError(Object.assign(new Error('request timeout'), { status: 408 }))).toBe(true)
  })

  it('does not bench a model for ordinary client/input failures', () => {
    expect(isTransientProviderError(Object.assign(new Error('bad request'), { statusCode: 400 }))).toBe(false)
    expect(isTransientProviderError(new Error('invalid prompt shape'))).toBe(false)
  })
})
