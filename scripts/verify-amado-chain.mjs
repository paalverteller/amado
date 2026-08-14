import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8')
const checks = []
const check = (name, condition, detail) => checks.push({ name, ok: Boolean(condition), detail })
const has = (file, ...needles) => {
  const text = read(file)
  return needles.every((needle) => text.includes(needle))
}

check('Market ingestion cron calls canonical RSS collector', has('app/api/cron/rss/route.ts', 'fetchAndSaveRss', "from('rss_sources')"), 'rss_sources -> fetchAndSaveRss')
check('RSS ingestion writes the evidence layer', has('lib/rss.ts', 'saveEvidence', 'recordIngestionRun'), 'RSS -> evidence_items + ingestion log')
check('Competitor sources share the normal ingestion pipeline', has('supabase/migrations/041_competitors.sql', 'competitor_id', 'rss_sources'), 'rss_sources.competitor_id')
check('Competitor review is grounded in evidence and enters Knowledge/RAG', has('lib/competitor-review.ts', "from('evidence_items')", "content_type: 'competitor_note'", 'processKnowledgeAsset'), 'evidence -> competitor_note -> chunks')
check('Market feed uses evidence IDs, not parallel rss_item IDs', has('app/api/market/route.ts', "from('evidence_items')", 'source_category'), 'market item.id is evidence_items.id')
check('Market -> Generate preserves the evidence ID', has('app/market/page.tsx', 'evidenceId=${encodeURIComponent(item.id)}', 'evidenceItemId: i.id'), 'single and batch lineage')
check('Generate UI uses canonical social formats', has('app/generate/page.tsx', "value: 'linkedin_post'", "value: 'instagram_carousel'", "value: 'x_thread'"), 'UI/API registry contract')
check('Single generation uses canonical orchestrator', has('app/api/generate/route.ts', 'generateAndPersistArticle', 'articleId: result.articleId'), 'exact generated article returned')
check('Generation resolves a default brand when none is explicitly selected', has('app/api/generate/route.ts', 'resolveDefaultBrandProfileId') && has('app/api/generate/batch/route.ts', 'resolveDefaultBrandProfileId') && has('app/generate/page.tsx', 'profile.is_default && profile.is_active'), 'Brand OS + competitor context stay on for first-use and batch flows')
check('Batch generation uses the same orchestrator', has('app/api/generate/batch/route.ts', 'generateAndPersistArticle', 'item.evidenceItemId'), 'no legacy prompt-only bypass')
check('Generation composes Brand OS, market, direct competitors and Knowledge/RAG', has('lib/content-generation/generate-article.ts', 'buildBrandSnapshot', 'getRecentEvidenceContext', 'buildCompetitorContext', 'buildKnowledgeContext', 'linkEvidence'), 'all context layers')
check('Knowledge lineage stores actual chunk IDs', has('lib/content-generation/generate-article.ts', 'knowledge.chunks.map((c) => c.chunkId)'), 'knowledge_chunk_ids = chunk_id')
check('Performance snapshots classify content patterns automatically', has('app/api/articles/[id]/performance/route.ts', 'recordArticlePattern'), 'performance -> explainable pattern metadata')
check('Overview has marketer control-center endpoint', has('app/api/overview/dashboard/route.ts', 'attention', 'campaigns', 'upcoming', 'recentPerformance', 'opportunities', 'insights'), 'six requested home sections')
check('Campaign/scheduling bridge is writable from the product', has('app/api/campaigns/route.ts', "from('marketing_campaigns')") && has('app/api/articles/[id]/route.ts', 'scheduled_for', 'marketing_campaign_id') && has('app/history/[id]/page.tsx', 'handleSchedule'), 'campaign instances + upcoming publication date')
check('Explainable analytics covers requested dimensions + fatigue', has('lib/marketing-analytics.ts', 'hooks:', 'themes:', 'pillars:', 'ctas:', 'lengths:', 'formats:', 'platforms:', 'detectFatigue', 'корреляция'), 'hook/topic/pillar/CTA/length/format/platform')
check('Telegram persistence constraint is repaired', has('supabase/migrations/045_marketer_control_center.sql', "'telegram_post'", 'articles_content_type_check'), 'canonical registry can persist Telegram')

const failed = checks.filter((item) => !item.ok)
for (const item of checks) console.log(`${item.ok ? 'PASS' : 'FAIL'}  ${item.name} — ${item.detail}`)
console.log(`\n${checks.length - failed.length}/${checks.length} chain checks passed.`)
if (failed.length) process.exit(1)
