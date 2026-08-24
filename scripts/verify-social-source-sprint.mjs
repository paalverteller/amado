#!/usr/bin/env node
import fs from 'node:fs'

const read = (path) => fs.readFileSync(path, 'utf8')
const checks = []

function check(name, condition) {
  const ok = Boolean(condition)
  checks.push({ name, ok })
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}`)
}

const rss = read('lib/rss.ts')
check(
  'RSS ingestion filters general market news before persistence',
  rss.includes('async function saveRows(') &&
    rss.includes('filteredByMarketEvidencePolicy') &&
    rss.includes("sourceMeta?.source_category === 'competitor'") &&
    rss.includes('eligibleRows'),
)

const policy = read('lib/market-source-policy.ts')
check(
  'market policy blocks politics sport entertainment and competitor noise',
  policy.includes('isMarketEvidenceEligible') &&
    policy.includes("'politics'") &&
    policy.includes("'sports'") &&
    policy.includes("'entertainment'") &&
    policy.includes("'competitor'"),
)

const evidence = read('lib/evidence.ts')
check(
  'recent automatic evidence is region-aware and policy-filtered',
  evidence.includes('regionId?: string | null') &&
    evidence.includes('source:source_id(source_category, region_id)') &&
    evidence.includes('isMarketEvidenceEligible'),
)

const generation = read('lib/content-generation/generate-article.ts')
const regionPos = generation.indexOf('const effectiveRegionId')
const recentPos = generation.indexOf('getRecentEvidenceContext(trimmedTopic')
check(
  'generation resolves market before choosing automatic evidence',
  regionPos >= 0 &&
    recentPos >= 0 &&
    regionPos < recentPos &&
    generation.includes('getRecentEvidenceContext(trimmedTopic, 5, effectiveRegionId)'),
)

check(
  'market feed applies market-news policy to historical evidence',
  read('app/api/market/route.ts').includes('isMarketEvidenceEligible'),
)

check(
  'daily briefing applies market-news policy',
  read('lib/briefing.ts').includes('source:source_id(source_category)') &&
    read('lib/briefing.ts').includes('isMarketEvidenceEligible'),
)

check(
  'overview opportunities apply market-news policy',
  read('app/api/overview/dashboard/route.ts').includes('sourceCategory: first(row.source)?.source_category'),
)

check(
  'deep market analysis applies market-news policy',
  read('app/api/market/deep-analysis/route.ts').includes('const eligibleRows = rows.filter') &&
    read('app/api/market/deep-analysis/route.ts').includes('isMarketEvidenceEligible'),
)

const playbookApi = read('app/api/brands/[brandId]/playbooks/route.ts')
check(
  'Brand OS platform API uses the real status schema',
  playbookApi.includes(".eq('status', 'active')") &&
    playbookApi.includes('strategy_json') &&
    playbookApi.includes('measurement_json') &&
    !playbookApi.includes("onlyActive: true"),
)

const playbookUi = read('components/brand/tabs/PlatformPlaybooksTab.tsx')
check(
  'Brand OS displays executable strategy and measurement rules',
  playbookUi.includes('strategy_json') &&
    playbookUi.includes('measurement_json') &&
    playbookUi.includes('Основные KPI') &&
    playbookUi.includes('Правила площадок'),
)

const socialPolicy = read('lib/social-generation-policy.ts')
check(
  'social brief is executable in canonical generation',
  socialPolicy.includes('Truth > speed') &&
    socialPolicy.includes('Business > vanity') &&
    socialPolicy.includes('Native > cross-post') &&
    socialPolicy.includes('Evidence > AI prose') &&
    generation.includes('buildSocialPlaybookContext') &&
    generation.includes('socialPlaybookContext'),
)

const formats = read('lib/content-formats.ts')
const generatePage = read('app/generate/page.tsx')
const prompts = read('lib/prompts.ts')
check(
  'Threads is a first-class social format',
  formats.includes("'threads_post'") &&
    formats.includes("platform: 'threads'") &&
    formats.includes("'threads_post': 'social_post'") &&
    generatePage.includes("{ value: 'threads_post', label: 'Threads' }") &&
    prompts.includes("if (format === 'threads_post')"),
)

check(
  'Threads has i18n parity',
  read('lib/i18n/config.ts').includes("'threads_post': 'Пост Threads'") &&
    read('lib/i18n/config.test.ts').includes("'threads_post'"),
)

const tests = read('lib/content-generation/generate-article.test.ts')
check(
  'generation unit tests isolate social-playbook DB access',
  tests.includes("vi.mock('@/lib/social-generation-policy'"),
)

const failed = checks.filter((item) => !item.ok)
console.log(`\n${checks.length - failed.length}/${checks.length} social/source sprint checks passed.`)
if (failed.length) process.exit(1)
