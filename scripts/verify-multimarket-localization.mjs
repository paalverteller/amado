#!/usr/bin/env node
import fs from 'node:fs'

const read = (rel) => fs.readFileSync(rel, 'utf8')
const checks = []

function check(name, condition) {
  const ok = Boolean(condition)
  checks.push({ name, ok })
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}`)
}

const locale = read('lib/locale.ts')
check(
  'BR ES DE US locales registered',
  ['BR:', 'ES:', 'DE:', 'US:'].every((value) => locale.includes(value)),
)

const switcher = read('components/MarketSwitcher.tsx')
check(
  'market selector has Russian BR ES DE US labels',
  ['Бразилия', 'Испания', 'Германия', 'США'].every((value) => switcher.includes(value)),
)

const brandPage = read('app/brand/page.tsx')
const brandsApi = read('app/api/brands/route.ts')
check(
  'Brand follows selected market',
  brandPage.includes('useMarket') &&
    brandPage.includes('/api/brands?region_id=') &&
    brandsApi.includes("searchParams.get('region_id')"),
)

const prompts = read('lib/prompts.ts')
check(
  'generation supports Spain Germany and US locale profiles',
  prompts.includes("ctx.locale === 'es-ES'") &&
    prompts.includes("ctx.locale === 'de-DE'") &&
    prompts.includes("ctx.locale === 'en-US'") &&
    prompts.includes("marketLabel: 'GERMAN MARKET SIGNALS'") &&
    prompts.includes("marketLabel: 'US MARKET SIGNALS'"),
)

const localize = read('app/api/localize/route.ts')
check(
  'Localization target follows selected market',
  localize.includes('resolveRegionProfile(body.regionId)') &&
    localize.includes('TARGET LOCALE: ${regionProfile.locale}') &&
    !localize.includes('Target locale is always Brazilian Portuguese'),
)

const rewrite = read('app/api/rewrite/route.ts')
check(
  'Rewrite target follows selected market',
  rewrite.includes('resolveRegionProfile(body.regionId)') &&
    rewrite.includes('Rewrite in ${regionProfile.languageName}') &&
    !rewrite.includes('Soe natural em português do Brasil'),
)

const deep = read('app/api/market/deep-analysis/route.ts')
check(
  'Deep market analysis follows selected market',
  deep.includes('resolveRegionProfile(body.regionId)') &&
    deep.includes('regionProfile.languageName') &&
    !deep.includes('Output in Brazilian Portuguese.'),
)

const seo = read('app/api/generate/seo/route.ts')
check(
  'SEO generation receives selected region',
  seo.includes('regionId: body.regionId'),
)

const competitors = read('app/competitors/page.tsx')
check(
  'Competitors follow selected market',
  competitors.includes('useMarket') &&
    competitors.includes('/api/competitors?region_id='),
)

const aiCheck = read('app/api/ai-check/route.ts')
const generatePage = read('app/generate/page.tsx')
check(
  'AI check follows selected market',
  aiCheck.includes('resolveRegionProfile(body.regionId)') &&
    aiCheck.includes('regionProfile.locale') &&
    aiCheck.includes('regionProfile.languageName') &&
    aiCheck.includes('regionProfile.name') &&
    generatePage.includes('regionId: currentRegionId || undefined') &&
    !aiCheck.includes('marketing digital no Brasil') &&
    !aiCheck.includes('Adequação ao público brasileiro'),
)

const visibleUiFiles = [
  'app/generate/page.tsx',
  'app/market/page.tsx',
  'app/ideas/page.tsx',
  'app/rewrite/page.tsx',
  'components/settings/TemplateCard.tsx',
  'components/RatingWidget.tsx',
  'components/brand/BrandOsEditor.tsx',
]

const ui = visibleUiFiles.map(read).join('\n')
const forbiddenUi = [
  'Tendências e Sinais',
  'Nada encontrado',
  'Carregando base…',
  'Descrição do estilo não disponível.',
  'Salvar avaliação',
  "label: 'Leve'",
  'Verificação AI',
  'Carregando workspace...',
  'Carregando workspace…',
  "'Value propositions'",
  "'Proof points'",
  "'CTA library'",
  "'Legal / disclaimers'",
  "'Общие platform rules'",
]

for (const leaked of forbiddenUi) {
  check(`no leaked UI: ${leaked}`, !ui.includes(leaked))
}

const failed = checks.filter((item) => !item.ok)
console.log(`\n${checks.length - failed.length}/${checks.length} multimarket localization checks passed.`)
if (failed.length) process.exit(1)
