import { describe, expect, it } from 'vitest'
import { DEFAULT_MARKET_CODE, resolveMarketCode, type MarketRegion } from './market-context'

const regions: MarketRegion[] = [
  { id: 'br-id', code: 'BR', name: 'Brasil' },
  { id: 'es-id', code: 'ES', name: 'España' },
  { id: 'de-id', code: 'DE', name: 'Deutschland' },
  { id: 'us-id', code: 'US', name: 'United States' },
]

describe('market context resolution', () => {
  it('preserves a valid non-Brazil stored market on first resolution', () => {
    expect(resolveMarketCode('ES', regions)).toBe('ES')
    expect(resolveMarketCode('DE', regions)).toBe('DE')
  })

  it('repairs a stale market to the configured default', () => {
    expect(resolveMarketCode('ZZ', regions)).toBe(DEFAULT_MARKET_CODE)
  })

  it('uses the first active region when Brazil is unavailable', () => {
    expect(resolveMarketCode(null, regions.slice(1))).toBe('ES')
  })

  it('never invents a fake region when no active regions exist', () => {
    expect(resolveMarketCode('BR', [])).toBeNull()
  })
})
