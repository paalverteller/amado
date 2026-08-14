#!/usr/bin/env node
import fs from 'node:fs'

const checks = []
const read = (path) => fs.readFileSync(path, 'utf8')
const requireCheck = (name, ok, detail) => {
  checks.push({ name, ok, detail })
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`)
}

const supabase = read('lib/supabase/client.ts')
requireCheck(
  'Supabase project URL is normalized before createClient',
  supabase.includes('normalizeSupabaseProjectUrl') &&
    supabase.includes('SUPABASE_SERVICE_SUFFIX') &&
    supabase.includes('repairedServiceSuffix'),
  'repairs accidental /rest/v1 and rejects arbitrary paths',
)

requireCheck(
  'Server-side SUPABASE_URL fallback exists',
  supabase.includes("process.env.SUPABASE_URL"),
  'NEXT_PUBLIC_SUPABASE_URL remains preferred',
)

const aiUtils = read('lib/ai-utils.ts')
requireCheck(
  'Google AI Studio key aliases are accepted',
  aiUtils.includes('GEMINI_API_KEY') &&
    aiUtils.includes('GOOGLE_GENERATIVE_AI_API_KEY') &&
    aiUtils.includes('getAiRuntimeInfo'),
  'either Google env name can drive @ai-sdk/google',
)

const ai = read('lib/ai.ts')
const requiredModels = [
  'gemini-3-flash-preview',
  'gemini-3.7-flash',
  'gemini-3.6-flash',
  'gemini-3.5-flash',
  'gemini-3.5-flash-lite',
]
requireCheck(
  'Google model fallback chain contains the MVP model set',
  requiredModels.every((model) => ai.includes(model)) &&
    ai.includes('AMADO_GOOGLE_MODEL_PRIMARY') &&
    ai.includes('AMADO_MVP_GOOGLE_PIPELINE_V1'),
  'preview primary is env-overridable; stable models remain fallback',
)

const health = read('app/api/admin/runtime-health/route.ts')
requireCheck(
  'Runtime health checks DB and AI without exposing keys',
  health.includes("from('brand_profiles')") &&
    health.includes("from('rss_sources')") &&
    health.includes("from('competitors')") &&
    health.includes('getAiRuntimeInfo'),
  '/api/admin/runtime-health',
)

const seed = read('supabase/seeds/002_mvp_brazil_saas.sql')
requireCheck(
  'MVP Brazil SaaS seed is additive and contains the requested competitors',
  !/\bDELETE\s+FROM\b/i.test(seed) &&
    ['Salesforce', 'monday.com', 'Slack'].every((name) => seed.includes(name)) &&
    [
      'https://www.meioemensagem.com.br/marketing',
      'https://exame.com/tecnologia/',
      'https://www.startse.com/artigos/',
      'https://www.salesforce.com/news/',
      'https://monday.com/blog/product/',
      'https://slack.com/blog/news',
    ].every((url) => seed.includes(url)),
  '3 Brazil market sources + 3 official competitor sources',
)

const vercel = JSON.parse(read('vercel.json'))
const cronPaths = (vercel.crons ?? []).map((cron) => cron.path)
requireCheck(
  'Legacy pre-pivot auto-generate cron is disabled',
  !cronPaths.includes('/api/cron/auto-generate'),
  'market refresh + briefing remain scheduled',
)
requireCheck(
  'Market refresh and briefing crons remain present',
  cronPaths.includes('/api/cron/market-refresh') &&
    cronPaths.includes('/api/cron/briefing'),
  cronPaths.join(', '),
)

const failures = checks.filter((check) => !check.ok)
console.log(`\n${checks.length - failures.length}/${checks.length} MVP runtime checks passed.`)
if (failures.length) process.exit(1)
