#!/usr/bin/env node
import fs from 'node:fs'

const checks = []
const read = (path) => fs.readFileSync(path, 'utf8')
const check = (name, condition, detail = '') => {
  const ok = Boolean(condition)
  checks.push({ name, ok })
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`)
}

const marketContext = read('lib/market-context.tsx')
check(
  'Market context has no fake fallback region',
  !marketContext.includes('br-fallback') &&
    marketContext.includes('ready: boolean') &&
    marketContext.includes('resolveMarketCode') &&
    marketContext.includes('const [regions, setRegions] = useState<MarketRegion[]>([])'),
)

const marketConsumers = [
  'app/brand/page.tsx',
  'app/generate/page.tsx',
  'app/generate/seo/page.tsx',
  'app/ideas/page.tsx',
  'app/localize/page.tsx',
  'app/market/analysis/page.tsx',
  'app/market/page.tsx',
  'app/rewrite/page.tsx',
  'app/settings/page.tsx',
  'app/competitors/page.tsx',
]
check(
  'Market-scoped workspaces wait for resolved market state',
  marketConsumers.every((path) => {
    const source = read(path)
    return source.includes('useMarket') && (source.includes('marketReady') || source.includes('ready'))
  }),
  `${marketConsumers.length} workspaces`,
)

const quickCreate = read('components/QuickCreateDialog.tsx')
check(
  'Quick Create submits only a real region id',
  quickCreate.includes('regionId: currentRegion.id') &&
    quickCreate.includes('marketUnavailable') &&
    !quickCreate.includes('br-fallback'),
)

const dialog = read('components/ui/AugustDialog.tsx')
check(
  'August dialog implements focus management',
  dialog.includes("event.key !== 'Tab'") &&
    dialog.includes('previousActiveElement') &&
    dialog.includes('focusableElements') &&
    dialog.includes('aria-describedby'),
)

const competitorPage = read('app/competitors/page.tsx')
check(
  'Competitor UI is market-safe and failure-visible',
  competitorPage.includes('AbortController') &&
    competitorPage.includes('aria-expanded') &&
    competitorPage.includes('role="alert"') &&
    competitorPage.includes('toast.error') &&
    competitorPage.includes('region_id: currentRegion.id'),
)

const competitorApi = read('app/api/competitors/route.ts')
check(
  'Competitor creation resolves market-specific Brand OS',
  competitorApi.includes('region_id?: string') &&
    competitorApi.includes('resolveBrandIdForRegion') &&
    competitorApi.includes('Competitor already exists in this market'),
)

const sourceApi = read('app/api/rss/route.ts')
const migration = read('supabase/migrations/047_competitor_source_links.sql')
check(
  'Competitor sources support many-to-many market reuse',
  sourceApi.includes("from('competitor_source_links')") &&
    migration.includes('PRIMARY KEY (competitor_id, source_id)') &&
    migration.includes('WHERE competitor_id IS NOT NULL'),
)

const review = read('lib/competitor-review.ts')
check(
  'Competitor review separates official and independent evidence',
  review.includes('OFFICIAL COMPANY SOURCE') &&
    review.includes('INDEPENDENT MARKET SOURCE') &&
    review.includes(".eq('region_id', regionId)") &&
    review.includes("source.source_category !== 'competitor'") &&
    review.includes("retrieval_mode: 'evidence'"),
)

const rss = read('lib/rss.ts')
check(
  'Competitor ingestion preserves company-news signals',
  rss.includes('preserveCompanyNews') &&
    rss.includes("data?.source_category === 'competitor'") &&
    rss.includes("'press release'") &&
    rss.includes('companyNewsSignals'),
)

const seed = read('supabase/seeds/009_market_intelligence_sprint_20260909.sql')
for (const code of ['BR', 'ES', 'DE', 'US']) {
  const matches = seed.match(new RegExp(`\\('${code}',\\d+,`, 'g')) ?? []
  check(`${code} competitor set has 12 entries`, matches.length === 12, `${matches.length}/12`)
}
for (const source of [
  'ABES — Press Releases',
  'Brasscom — Publicações',
  'Red.es — Noticias',
  'Adigital — Actualidad',
  'Bitkom — Presseinformationen',
  'CIO — Enterprise Applications',
  'Software Advice — Resources',
]) {
  check(`Market source seeded: ${source}`, seed.includes(source))
}
for (const competitor of ['Ploomes', 'Kenlo', 'Holded', 'Witei', 'sevdesk', 'onOffice', 'Follow Up Boss']) {
  check(`Vertical/local competitor seeded: ${competitor}`, seed.includes(`'${competitor}'`))
}
check(
  'Seed does not assume rss_sources.updated_at exists',
  !/UPDATE rss_sources[\s\S]{0,180}updated_at/i.test(seed) &&
    !/ON CONFLICT \(url\) DO UPDATE SET[\s\S]{0,500}updated_at = now\(\);/i.test(seed),
)

const roadmap = read('docs/AMADO_ROADMAP.md')
check(
  'Roadmap closes Fable phases 5 and 6',
  roadmap.includes('Fable remediation Phases 0–6 are complete') && !roadmap.includes('### 1. Fable Phase 5'),
)

const failures = checks.filter((item) => !item.ok)
console.log(`\n${checks.length - failures.length}/${checks.length} market-intelligence sprint checks passed.`)
if (failures.length) process.exit(1)
