import { describe, expect, it } from 'vitest'
import { isMarketEvidenceEligible } from './market-source-policy'

describe('market source policy', () => {
  it('keeps business and SaaS news', () => {
    expect(isMarketEvidenceEligible({
      sourceCategory: 'enterprise_tech',
      title: 'SMBs increase AI adoption for customer service',
      summary: 'New survey covers CRM, automation and cloud software.',
    })).toBe(true)
  })

  it('keeps business-relevant regulation', () => {
    expect(isMarketEvidenceEligible({
      sourceCategory: 'business',
      title: 'New privacy rules change data retention requirements for SaaS companies',
    })).toBe(true)
  })

  it('blocks election politics in supported languages', () => {
    for (const title of [
      'Presidential election campaign enters final month',
      'Lula comenta campanha eleitoral',
      'Pedro Sánchez afronta una nueva campaña electoral',
      'Bundestagswahl: Parteien starten in den Wahlkampf',
    ]) {
      expect(isMarketEvidenceEligible({ title })).toBe(false)
    }
  })

  it('blocks sport and entertainment noise', () => {
    expect(isMarketEvidenceEligible({ title: 'Champions League final preview' })).toBe(false)
    expect(isMarketEvidenceEligible({ title: 'Reality show breaks audience record' })).toBe(false)
  })

  it('keeps competitor evidence out of the general market feed', () => {
    expect(isMarketEvidenceEligible({
      sourceCategory: 'competitor',
      title: 'Product launch',
    })).toBe(false)
  })
})
