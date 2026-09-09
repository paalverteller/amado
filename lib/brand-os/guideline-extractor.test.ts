import { describe, it, expect, vi } from 'vitest'

// Fable review, Phase 2 (docs/fable-review.md): a brand with no region_id
// set used to silently fall through to a Brazil-language guideline
// extraction (resolveBrandRegionId -> null -> resolveRegionProfile(null)
// -> DEFAULT_REGION_PROFILE) instead of a clear, actionable error. Given a
// brand is the unit this operates on, this is now a thrown
// BrandRegionRequiredError instead -- the import route (Phase 1B) catches
// it and returns 400 instead of the generic 500 every other extraction
// failure gets.
vi.mock('@/lib/brand-snapshot', () => ({
  resolveBrandRegionId: vi.fn(),
}))
vi.mock('@/lib/prompts', () => ({
  resolveRegionProfile: vi.fn(),
}))
vi.mock('@/lib/ai', () => ({
  generateArticleWithFallback: vi.fn(),
}))

describe('extractGuidelineRules region requirement (Phase 2 fix)', () => {
  it('throws BrandRegionRequiredError before any LLM call when the brand has no region_id', async () => {
    const { resolveBrandRegionId } = await import('@/lib/brand-snapshot')
    const { generateArticleWithFallback } = await import('@/lib/ai')
    const { extractGuidelineRules, BrandRegionRequiredError } = await import('./guideline-extractor')

    vi.mocked(resolveBrandRegionId).mockResolvedValueOnce(null)

    await expect(
      extractGuidelineRules({ sourceType: 'manual', sourceText: 'some text', brandId: 'brand-no-region' })
    ).rejects.toBeInstanceOf(BrandRegionRequiredError)

    // The whole point of failing fast here is to avoid burning a paid LLM
    // call on a request that can't be completed correctly -- confirm the
    // extraction call never happened.
    expect(generateArticleWithFallback).not.toHaveBeenCalled()
  })

  it('includes the brandId in the error so the caller can act on it', async () => {
    const { resolveBrandRegionId } = await import('@/lib/brand-snapshot')
    const { extractGuidelineRules, BrandRegionRequiredError } = await import('./guideline-extractor')

    vi.mocked(resolveBrandRegionId).mockResolvedValueOnce(null)

    try {
      await extractGuidelineRules({ sourceType: 'manual', sourceText: 'x', brandId: 'brand-abc-123' })
      expect.unreachable('expected extractGuidelineRules to throw')
    } catch (err) {
      expect(err).toBeInstanceOf(BrandRegionRequiredError)
      expect((err as InstanceType<typeof BrandRegionRequiredError>).brandId).toBe('brand-abc-123')
      expect((err as Error).message).toContain('brand-abc-123')
    }
  })

  it('proceeds normally (no throw from the region check) when the brand has a region_id', async () => {
    const { resolveBrandRegionId } = await import('@/lib/brand-snapshot')
    const { resolveRegionProfile } = await import('@/lib/prompts')
    const { generateArticleWithFallback } = await import('@/lib/ai')
    const { extractGuidelineRules } = await import('./guideline-extractor')

    vi.mocked(resolveBrandRegionId).mockResolvedValueOnce('region-es')
    vi.mocked(resolveRegionProfile).mockResolvedValueOnce({
      code: 'ES', name: 'Spain', locale: 'es-ES', languageName: 'Spanish (Spain)',
    })
    vi.mocked(generateArticleWithFallback).mockResolvedValueOnce({
      text: JSON.stringify({ rules: [], detectedConflicts: [], summary: 'ok', requiresLegalReview: false, totalCandidates: 0, highConfidenceCount: 0 }),
      model: 'test-model',
      usage: null,
    })

    await expect(
      extractGuidelineRules({ sourceType: 'manual', sourceText: 'some text', brandId: 'brand-with-region' })
    ).resolves.toBeDefined()

    expect(generateArticleWithFallback).toHaveBeenCalledTimes(1)
  })
})
