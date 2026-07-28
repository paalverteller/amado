/**
 * Seed Data Validation Script
 * Validates Sprint 2 seed data (migration 037) against schema expectations
 */

import { createClient } from '@/lib/supabase'

interface ValidationResult {
  table: string
  expected: number
  actual: number
  passed: boolean
  details?: string[]
}

async function validateSeedData(): Promise<ValidationResult[]> {
  const supabase = createClient()
  const results: ValidationResult[] = []

  // 1. Validate brand_products
  const { data: products } = await supabase
    .from('brand_products')
    .select('*')
    .eq('brand_id', 'bitrix24-brasil')
  
  results.push({
    table: 'brand_products',
    expected: 3,
    actual: products?.length || 0,
    passed: (products?.length || 0) >= 3,
    details: products?.map(p => `${p.name} (${p.product_role})`),
  })

  // 2. Validate brand_capabilities
  const { data: capabilities } = await supabase
    .from('brand_capabilities')
    .select('*')
    .eq('brand_id', 'bitrix24-brasil')
  
  results.push({
    table: 'brand_capabilities',
    expected: 6,
    actual: capabilities?.length || 0,
    passed: (capabilities?.length || 0) >= 6,
    details: capabilities?.map(c => c.name),
  })

  // 3. Validate brand_audiences
  const { data: audiences } = await supabase
    .from('brand_audiences')
    .select('*')
    .eq('brand_id', 'bitrix24-brasil')
  
  results.push({
    table: 'brand_audiences',
    expected: 4,
    actual: audiences?.length || 0,
    passed: (audiences?.length || 0) >= 4,
    details: audiences?.map(a => a.name),
  })

  // 4. Validate brand_pain_points
  const { data: pains } = await supabase
    .from('brand_pain_points')
    .select('*')
    .eq('brand_id', 'bitrix24-brasil')
  
  results.push({
    table: 'brand_pain_points',
    expected: 5,
    actual: pains?.length || 0,
    passed: (pains?.length || 0) >= 5,
    details: pains?.map(p => p.canonical_name),
  })

  // 5. Validate brand_content_pillars
  const { data: pillars } = await supabase
    .from('brand_content_pillars')
    .select('*')
    .eq('brand_id', 'bitrix24-brasil')
  
  results.push({
    table: 'brand_content_pillars',
    expected: 5,
    actual: pillars?.length || 0,
    passed: (pillars?.length || 0) >= 5,
    details: pillars?.map(p => `${p.name} (order: ${p.sort_order})`),
  })

  // 6. Validate campaign_profiles
  const { data: campaigns } = await supabase
    .from('campaign_profiles')
    .select('*')
    .eq('brand_id', 'bitrix24-brasil')
  
  results.push({
    table: 'campaign_profiles',
    expected: 3,
    actual: campaigns?.length || 0,
    passed: (campaigns?.length || 0) >= 3,
    details: campaigns?.map(c => c.name),
  })

  // 7. Validate brand_terms
  const { data: terms } = await supabase
    .from('brand_terms')
    .select('*')
    .eq('brand_id', 'bitrix24-brasil')
  
  results.push({
    table: 'brand_terms',
    expected: 5,
    actual: terms?.length || 0,
    passed: (terms?.length || 0) >= 5,
    details: terms?.map(t => `${t.term} (${t.policy})`),
  })

  // 8. Validate platform_playbooks
  const { data: playbooks } = await supabase
    .from('platform_playbooks')
    .select('*')
    .eq('brand_id', 'bitrix24-brasil')
  
  results.push({
    table: 'platform_playbooks',
    expected: 5,
    actual: playbooks?.length || 0,
    passed: (playbooks?.length || 0) >= 5,
    details: playbooks?.map(p => `${p.platform} / ${p.format}`),
  })

  // 9. Validate approved_examples
  const { data: examples } = await supabase
    .from('approved_examples')
    .select('*')
    .eq('brand_id', 'bitrix24-brasil')
  
  results.push({
    table: 'approved_examples',
    expected: 3,
    actual: examples?.length || 0,
    passed: (examples?.length || 0) >= 3,
    details: examples?.map(e => `${e.platform} / ${e.format}`),
  })

  // 10. Validate brand_claims
  const { data: claims } = await supabase
    .from('brand_claims')
    .select('*')
    .eq('brand_id', 'bitrix24-brasil')
  
  results.push({
    table: 'brand_claims',
    expected: 4,
    actual: claims?.length || 0,
    passed: (claims?.length || 0) >= 4,
    details: claims?.map(c => `${c.claim_type}: ${c.claim_text.substring(0, 50)}...`),
  })

  return results
}

// CLI execution
if (require.main === module) {
  validateSeedData()
    .then(results => {
      console.log('\n=== Seed Data Validation Report ===\n')
      
      let allPassed = true
      for (const result of results) {
        const status = result.passed ? '✅ PASS' : '❌ FAIL'
        console.log(`${status} | ${result.table}: ${result.actual}/${result.expected}`)
        if (result.details) {
          result.details.forEach(d => console.log(`         - ${d}`))
        }
        if (!result.passed) allPassed = false
      }
      
      console.log(`\n${allPassed ? '✅ All validations passed' : '❌ Some validations failed'}`)
      process.exit(allPassed ? 0 : 1)
    })
    .catch(err => {
      console.error('Validation error:', err)
      process.exit(1)
    })
}

export { validateSeedData }
