import { describe, expect, it } from 'vitest'
import { classifyContentPattern, detectCtaType, detectHookType, detectLengthBucket } from './content-patterns'

describe('content pattern classifier', () => {
  it('classifies a data hook, WhatsApp CTA, canonical format and matching pillar with evidence', () => {
    const result = classifyContentPattern({
      id: 'a1',
      topic: 'Automação de vendas para pequenas empresas',
      content_type: 'social_post',
      draft_content: '37% das equipes ainda perdem tempo com tarefas manuais. Automatize o processo e fale com a gente no WhatsApp.',
      final_content: null,
      char_count: 112,
      brand_profile_id: 'b1',
      request: { content_format: 'linkedin_post' },
    }, [{ id: 'p1', name: 'Automação e produtividade', purpose: 'Automação para equipes produtivas' }])

    expect(result.hookType).toBe('data')
    expect(result.ctaType).toBe('whatsapp')
    expect(result.contentFormat).toBe('linkedin_post')
    expect(result.lengthBucket).toBe('micro')
    expect(result.pillarId).toBe('p1')
    expect(result.evidence.hook).toContain('número')
    expect(result.evidence.pillarMatchedTerms.length).toBeGreaterThan(0)
  })

  it('keeps deterministic hook/cta rules small and inspectable', () => {
    expect(detectHookType('Você ainda faz isso manualmente?').type).toBe('question')
    expect(detectCtaType('Gostou? Salve este post para consultar depois.').type).toBe('save')
    expect(detectLengthBucket(301)).toBe('short')
    expect(detectLengthBucket(1801)).toBe('long')
  })
})
