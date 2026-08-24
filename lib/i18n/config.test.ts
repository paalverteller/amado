import { describe, expect, it } from 'vitest'
import { t, setLocale, getLocale, SUPPORTED_LOCALES, DEFAULT_LOCALE } from './config'

// Keys that must exist in every locale dictionary. Mirrors PT_BR_DICT (the
// original source of truth) so a future copy change can't silently ship
// without a Russian counterpart — this is the regression guard for Sprint 1.
const REQUIRED_SECTIONS: Record<string, string[]> = {
  nav: ['overview', 'generate', 'market', 'ideas', 'rewrite', 'history', 'settings', 'knowledge', 'brand', 'competitors'],
  action: ['create', 'save', 'delete', 'edit', 'cancel', 'confirm', 'generate', 'approve', 'reject', 'export', 'publish', 'schedule', 'dismiss', 'watch', 'refresh', 'test', 'add', 'remove', 'search', 'filter', 'sort'],
  format: ['article', 'linkedin_post', 'instagram_caption', 'instagram_carousel', 'x_thread', 'threads_post', 'facebook_post', 'telegram_post', 'short_video_script', 'email', 'quick_note', 'rewrite'],
  status: ['draft', 'review', 'approved', 'scheduled', 'published', 'dismissed', 'active', 'inactive'],
  settings: ['title', 'subtitle', 'sources', 'templates', 'brands', 'regions', 'language'],
  market: ['title', 'signals', 'no_items', 'source', 'published', 'collected'],
  generate: ['title', 'topic', 'context', 'content_type', 'generating', 'copy', 'download'],
  error: ['generic', 'network', 'unauthorized', 'not_found', 'validation', 'server'],
  product: ['name', 'tagline', 'description'],
  overview: ['title', 'subtitle', 'freshness_label', 'no_briefing_title', 'no_briefing_body', 'go_to_market'],
  knowledge: ['title', 'subtitle', 'coming_soon_title', 'coming_soon_body'],
  competitors: ['title', 'subtitle', 'coming_soon_title', 'coming_soon_body'],
}

describe('i18n dictionary — Russian parity', () => {
  it('defaults to Russian as the primary UI locale', () => {
    expect(DEFAULT_LOCALE).toBe('ru')
    expect(SUPPORTED_LOCALES).toContain('ru')
  })

  it('resets to the default locale (guards test ordering)', () => {
    setLocale('ru')
    expect(getLocale()).toBe('ru')
  })

  for (const [section, keys] of Object.entries(REQUIRED_SECTIONS)) {
    for (const key of keys) {
      it(`has a Russian translation for "${section}.${key}"`, () => {
        const value = t(`${section}.${key}`, 'ru')
        // t() returns the raw key string when a translation is missing.
        expect(value).not.toBe(`${section}.${key}`)
        expect(value.length).toBeGreaterThan(0)
      })
    }
  }

  it('documents the fallback behavior for a genuinely unknown key', () => {
    expect(t('nonexistent.key', 'ru')).toBe('nonexistent.key')
  })
})
