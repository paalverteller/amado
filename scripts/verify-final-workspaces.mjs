#!/usr/bin/env node
import fs from 'node:fs'

const checks = []
const read = (path) => fs.readFileSync(path, 'utf8')
const check = (name, ok, detail = '') => {
  checks.push({ name, ok })
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`)
}

const proxy = read('proxy.ts')
check(
  'Unauthenticated August assets are public',
  proxy.includes('PUBLIC_ASSET_RE') && proxy.includes('PUBLIC_ASSET_RE.test(pathname)'),
  'login favicon no longer redirects to auth',
)

const layout = read('components/Layout.tsx')
check(
  'Localization is a first-class desktop/PWA destination',
  layout.includes("href: '/localize'") && layout.includes("'localize'") &&
    layout.includes("label: 'Локализация'") && layout.includes("href: '/history', label: 'История'"),
  'PWA keeps four destinations + More',
)

check(
  'Localization workspace uses editable prompt + Brand OS',
  read('app/localize/page.tsx').includes('/api/prompts?contentType=localization') &&
    read('app/api/localize/route.ts').includes("contains('content_types', ['localization'])") &&
    read('app/api/localize/route.ts').includes('<brand_context>'),
)

const promptStudio = read('components/settings/PromptStudio.tsx')
check(
  'Prompt Library supports create and full edit',
  promptStudio.includes("method: draft.id ? 'PATCH' : 'POST'") &&
    promptStudio.includes('system_prompt') &&
    promptStudio.includes('content_types'),
)

const seed = read('supabase/seeds/003_final_workspaces.sql')
for (const name of [
  'Localization · Native pt-BR',
  'X · Performance 95 posts / 87 days',
  'Facebook · Pragmático Esclarecido',
  'Instagram & Meta · Brazil 2026',
  'LinkedIn · Brazil B2B SaaS 2026',
  'SEO Article · PMEs Brazil 2026',
  'Market Analysis · SMEs Brazil 60d',
]) {
  check(`Prompt seeded: ${name}`, seed.includes(name) && seed.includes('ON CONFLICT (name) DO NOTHING'))
}

const seo = read('app/api/generate/seo/route.ts')
check(
  'SEO workspace reuses canonical generation + evidence',
  seo.includes('generateAndPersistArticle') &&
    seo.includes("contains('content_types', ['seo_article'])") &&
    seo.includes("from('evidence_items')") &&
    seo.includes('evidenceItemIds'),
)

const market = read('app/api/market/deep-analysis/route.ts')
check(
  'Deep market analysis is a strict 60-day evidence workflow',
  market.includes('60 * 24 * 60 * 60 * 1000') &&
    market.includes("from('evidence_items')") &&
    market.includes('You do NOT have live web browsing') &&
    market.includes('processKnowledgeAsset'),
)

const brand = read('app/api/brands/[brandId]/os/route.ts')
check(
  'Brand OS has a writable core/pillars/terms API',
  brand.includes("from('brand_profiles')") &&
    brand.includes("from('brand_content_pillars')") &&
    brand.includes("from('brand_terms')") &&
    read('components/brand/BrandOsEditor.tsx').includes('Редактор Brand OS'),
)

check(
  'Generate exposes the dedicated SEO workspace',
  read('app/generate/page.tsx').includes('/generate/seo'),
)
check(
  'Market exposes deep analysis',
  read('app/market/page.tsx').includes('/market/analysis'),
)
check(
  'Settings embeds Prompt Library',
  read('app/settings/page.tsx').includes('<PromptStudio />'),
)

const failures = checks.filter((item) => !item.ok)
console.log(`\n${checks.length - failures.length}/${checks.length} final workspace checks passed.`)
if (failures.length) process.exit(1)
