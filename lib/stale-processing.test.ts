import { describe, expect, it } from 'vitest'
import {
  STALE_PROCESSING_THRESHOLD_MINUTES,
  buildStaleProcessingCutoff,
  buildStaleProcessingTimeoutMessage,
} from './stale-processing'

describe('stale processing policy', () => {
  it('uses a conservative 15-minute threshold', () => {
    expect(STALE_PROCESSING_THRESHOLD_MINUTES).toBe(15)
    expect(buildStaleProcessingCutoff(new Date('2026-09-09T12:00:00.000Z')))
      .toBe('2026-09-09T11:45:00.000Z')
  })

  it('writes deterministic terminal-state reasons for both job types', () => {
    expect(buildStaleProcessingTimeoutMessage('content_request')).toContain('Content request')
    expect(buildStaleProcessingTimeoutMessage('guideline_import')).toContain('Guideline import')
    expect(buildStaleProcessingTimeoutMessage('content_request')).toContain('15 minutes')
  })
})
