import { describe, it, expect } from 'vitest'
import { buildUserPrompt } from './prompts'

// Fable review, Phase 2 (docs/fable-review.md): resolveLanguageProfile's
// generic fallback branch used to be gated on
// `ctx.languageName !== 'Portuguese (Brazil)'` -- a string-equality
// self-reference against the exact literal DEFAULT_REGION_PROFILE falls
// back to elsewhere in the same file -- and its final fallback hardcoded
// Brazil for every region not explicitly curated (BR/ES/DE/US), regardless
// of what real region data was available. These tests exercise the fix
// through buildUserPrompt's observable output (the language name and
// market adjective are interpolated directly into the returned prompt
// text), rather than via an internal/private function, since that's the
// actual behavior this bug affects.
describe('buildUserPrompt region/language resolution (Phase 2 fix)', () => {
  it('uses Portuguese (Brazil) when no regionContext is given at all (documented default)', () => {
    const prompt = buildUserPrompt({ topic: 'test topic', format: 'quick_note' })
    expect(prompt).toContain('Portuguese (Brazil)')
    expect(prompt).toContain('Brazilian market')
  })

  it('uses the curated Spanish (Spain) profile for es-ES', () => {
    const prompt = buildUserPrompt({
      topic: 'test topic',
      format: 'quick_note',
      regionContext: { locale: 'es-ES', regionName: 'Spain', languageName: 'Spanish (Spain)' },
    })
    expect(prompt).toContain('Spanish (Spain)')
    expect(prompt).toContain('Spanish market')
  })

  it('uses the curated German (Germany) profile for de-DE', () => {
    const prompt = buildUserPrompt({
      topic: 'test topic',
      format: 'quick_note',
      regionContext: { locale: 'de-DE', regionName: 'Germany', languageName: 'German (Germany)' },
    })
    expect(prompt).toContain('German (Germany)')
    expect(prompt).toContain('German market')
  })

  it('does NOT collapse an uncurated non-Brazil region (e.g. Italy) into Brazil', () => {
    // This is the exact regression the old string-equality check risked:
    // any locale not in {es-ES, de-DE, en-US} used to require
    // languageName !== 'Portuguese (Brazil)' to escape the Brazil
    // fallback, and the fallback below THAT was hardcoded Brazil
    // regardless of real region data present in ctx. Italy is seeded in
    // the regions table (see supabase/migrations/023) but has no curated
    // branch in resolveLanguageProfile -- it must use its own real region
    // data, not silently become Brazilian Portuguese.
    const prompt = buildUserPrompt({
      topic: 'test topic',
      format: 'quick_note',
      regionContext: { locale: 'it-IT', regionName: 'Italy', languageName: 'Italian (Italy)' },
    })
    expect(prompt).toContain('Italian (Italy)')
    expect(prompt).not.toContain('Portuguese (Brazil)')
    expect(prompt).not.toContain('Brazilian market')
  })

  it('falls back to Brazil only when regionContext.locale genuinely matches the Brazil default', () => {
    const prompt = buildUserPrompt({
      topic: 'test topic',
      format: 'quick_note',
      regionContext: { locale: 'pt-BR', regionName: 'Brazil', languageName: 'Portuguese (Brazil)' },
    })
    expect(prompt).toContain('Portuguese (Brazil)')
    expect(prompt).toContain('Brazilian market')
  })
})
