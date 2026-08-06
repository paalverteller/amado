/**
 * lib/rss.ts  —  Market ingestion engine (Stage 2)
 *
 * Changes:
 *   - Dual-write to evidence_items (§9.3)
 *   - Source health tracking
 *   - Ingestion run observability
 *   - Canonical URL normalization
 *   - Content fingerprinting
 */

import Parser from 'rss-parser'
import crypto from 'crypto'
import { getSupabaseAdmin } from '@/lib/supabase/client'
import { readUrlAsText } from '@/lib/web-reader'
import { isFeatureEnabled, INGESTION_CONFIG } from '@/lib/amado-config'
import { saveEvidence, recordSourceHealth, recordIngestionRun } from '@/lib/evidence'
import type { ConnectorType } from '@/lib/ingestion/types'
import { getErrorMessage } from '@/lib/api/error-message'

const RSS_TIMEOUT_MS = INGESTION_CONFIG.sourceTimeoutMs
const MAX_ITEMS_PER_SOURCE = INGESTION_CONFIG.maxItemsPerSource
const MAX_DESC_CHARS = INGESTION_CONFIG.maxSnippetChars

// Hydration budget: shared across every source processed within a single
// cron/collect invocation. Reset explicitly at the top of each route
// handler via resetHydrationBudget() -- see app/api/cron/rss/route.ts and
// app/api/rss/collect/route.ts. Module-level state is correct here because
// one request = one pass over all active sources = one budget.
let hydrationBudgetRemaining = INGESTION_CONFIG.maxHydrationPerRun

export function resetHydrationBudget(): void {
  hydrationBudgetRemaining = INGESTION_CONFIG.maxHydrationPerRun
}

const parser = new Parser({
  timeout: RSS_TIMEOUT_MS,
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Accept': 'application/rss+xml, application/atom+xml, application/xml, text/xml, */*',
    'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
    'Cache-Control': 'no-cache',
    'Pragma': 'no-cache',
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'none'
  },
})

type RssRow = {
  source_id: string
  title: string
  description: string
  link: string
  published_at: string | null
  source_language?: string | null
  /** Set when the caller already has full text (e.g. html_index already
   *  called readUrlAsText to build the description) -- lets saveRows skip
   *  a redundant second fetch of the same URL. */
  fullText?: string | null
}

export function stripHtml(v: string | undefined | null): string {
  if (!v) return ''
  return v
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ').trim()
}

function isIrrelevantContent(title: string, description: string): boolean {
  const text = `${title} ${description}`.toLowerCase()
  const badWords = [
    'job', 'jobs', 'vacancy', 'vacancies', 'hiring', 'apply now', 'career', 'position available',
    'we are looking', 'join our team', 'full.?time', 'part.?time', 'salary', 'stipend', 'internship',
    'fellowship', 'conference', 'workshop', 'webinar', 'register now', 'sign up now', 'subscribe',
    'advertisement', 'sponsored', 'promo code', 'discount', 'free trial', 'maintenance', 'downtime',
    'under construction', 'postdoc', 'postdoctoral', 'bolsa de', 'vaga',
    'support center', 'publishing', 'resources and help', 'join the', 'become a part',
    'aims and scope', 'guidelines', 'author guidelines', 'ethics', 'policy', 'instructions for authors',
    'training', 'course', 'program', 'success stories', 'news and events', 'achievements', 'awards',
    'editorial board', 'about the journal', 'supplementary materials', 'policies',
    'about us', 'all rights reserved', 'cookie', 'copyright',
    'magazine', 'journal issue', 'special issue', 'archive',
    'call for papers',
    'philips', 'product number', 'select country', 'country selector', 'select language',
    'healthcare solutions', 'professional display', 'display solutions', 'monitoring solutions',
    'diagnostic imaging', 'patient monitoring', 'electronic health', 'medical device',
    'wef ', 'world economic forum', 'davos', 'annual meeting',
    'investor relations', 'press release', 'shareholder', 'quarterly results'
  ].join('|')
  const regex = new RegExp(`\\b(${badWords})\\b`, 'i')
  return regex.test(text)
}

async function saveRows(sourceId: string, rows: RssRow[], connectorType: string): Promise<number> {
  if (rows.length === 0) return 0
  const unique = Array.from(new Map(rows.map((r) => [r.link, r])).values())
  
  // Legacy: write to rss_items
  const { data, error } = await getSupabaseAdmin()
    .from('rss_items')
    .upsert(unique, { onConflict: 'link', ignoreDuplicates: true })
    .select('id')
  if (error) throw new Error(`Save failed: ${error.message}`)
  
  // Stage 2: Dual-write to evidence_items (best-effort), with full-text
  // hydration when budget and config allow. Concurrent per source (rows is
  // already capped upstream, worst case 15 for PubMed) rather than
  // sequential, so one source's hydration can't multiply the outer
  // per-source loop's wall-clock time by MAX_ITEMS_PER_SOURCE.
  let evidenceSaved = 0
  const settled = await Promise.allSettled(unique.map(async (row) => {
    let fullText: string | null = row.fullText ?? null
    if (!fullText && INGESTION_CONFIG.hydrationEnabled && hydrationBudgetRemaining > 0) {
      hydrationBudgetRemaining--
      try {
        fullText = await readUrlAsText(row.link)
      } catch (hydrationError) {
        console.warn(`[rss] Hydration failed for ${row.link}:`, getErrorMessage(hydrationError))
      }
    }

    await saveEvidence({
      sourceId: row.source_id,
      canonicalUrl: row.link,
      sourceTitle: row.title,
      sourceSummary: row.description,
      sourceLanguage: row.source_language ?? 'pt-BR',
      publishedAt: row.published_at,
      fullText,
    })
  }))
  for (const outcome of settled) {
    if (outcome.status === 'fulfilled') {
      evidenceSaved++
    } else {
      console.warn('[rss] Evidence save error (non-critical):', getErrorMessage(outcome.reason))
    }
  }
  if (evidenceSaved < unique.length) {
    console.warn(`[rss] Evidence dual-write: ${evidenceSaved}/${unique.length} saved`)
  }
  
  // Record ingestion run
  await recordIngestionRun({
    sourceId,
    connectorType,
    itemsDiscovered: rows.length,
    itemsSaved: data?.length ?? 0,
    success: true,
  })
  
  // Record source health
  await recordSourceHealth({
    sourceId,
    eventType: 'success',
    itemsYielded: data?.length ?? 0,
  })
  
  return data?.length ?? 0
}

// ─── PubMed (gated, retired by default) ─────────────────────────────────────

async function fetchPubMed(sourceId: string, queryHint = 'mental_health'): Promise<number> {
  if (!isFeatureEnabled('pubMedEnabled')) {
    console.info('[rss] PubMed ingestion disabled by feature flag')
    return 0
  }

  const PUBMED_QUERIES: Record<string, string> = {
    mental_health: '(psychology[MeSH] OR psychotherapy[MeSH] OR "mental health"[MeSH] OR "cognitive behavioral therapy" OR neuroscience[MeSH] OR "emotional regulation" OR "well-being" OR mindfulness OR "social cognition" OR "psychiatric disorder"[MeSH]) AND humans[MeSH] NOT ("armed conflict" OR "war" OR "HIV" OR "dengue" OR "asthma" OR "obstetrics" OR "surgery" OR "cancer" OR "oncology" OR "cardiology" OR "vaccination" OR "famine" OR "Yemen" OR "Palestine" OR "Ukraine")',
    asia_psychology: '(psychology OR psychotherapy OR neuroscience OR "mental health") AND (Japan[Affiliation] OR Korea[Affiliation] OR China[Affiliation] OR Singapore[Affiliation] OR India[Affiliation]) AND humans[MeSH]',
    latam_psychology: '(psychology OR psychotherapy OR "mental health" OR "salud mental" OR psicologia) AND (Brazil[Affiliation] OR Argentina[Affiliation] OR Mexico[Affiliation] OR Colombia[Affiliation] OR Chile[Affiliation] OR Peru[Affiliation]) AND humans[MeSH]',
  }
  const q = encodeURIComponent(PUBMED_QUERIES[queryHint] ?? PUBMED_QUERIES['mental_health'])
  try {
    const searchRes = await fetch(
      `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&term=${q}&sort=pub+date&retmode=json&retmax=15`,
      { signal: AbortSignal.timeout(10_000) },
    )
    if (!searchRes.ok) return 0
    const searchData = await searchRes.json() as { esearchresult?: { idlist?: string[] } }
    const ids = searchData.esearchresult?.idlist ?? []
    if (ids.length === 0) return 0

    const summaryRes = await fetch(
      `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=pubmed&id=${ids.join(',')}&retmode=json`,
      { signal: AbortSignal.timeout(10_000) },
    )
    if (!summaryRes.ok) return 0
    const summaryData = await summaryRes.json() as {
      result?: Record<string, { title?: string; source?: string }>
    }

    const rows: RssRow[] = []
    for (const id of ids) {
      const item = summaryData.result?.[id]
      const title = stripHtml(item?.title)
      if (title.length < 15) continue
      const description = item?.source ? `Published in ${item.source}. ${title}` : title
      rows.push({
        source_id: sourceId,
        title,
        description: description.slice(0, MAX_DESC_CHARS),
        link: `https://pubmed.ncbi.nlm.nih.gov/${id}/`,
        published_at: new Date().toISOString(),
        source_language: 'en',
      })
    }
    return saveRows(sourceId, rows, 'api')
  } catch (err) {
    console.warn('[rss] PubMed error:', getErrorMessage(err))
    await recordSourceHealth({
      sourceId,
      eventType: 'failure',
      errorMessage: getErrorMessage(err),
    })
    return 0
  }
}

// ─── HTML fallback ────────────────────────────────────────────────────────────

function isArticleHref(href: string, base: URL): URL | null {
  try {
    const abs = new URL(href, base)
    if (abs.hostname !== base.hostname) return null
    if (abs.pathname === base.pathname || abs.pathname === '/') return null
    if (/\/(search|login|register|signup|cart|checkout|account|admin|wp-admin|feed|rss|api|about|policy|ethics|guidelines|author|training|course|events|aims|editorial|contact|submit)\b/i.test(abs.pathname)) return null
    if (href.startsWith('#')) return null
    if (/\.(css|js|png|jpg|jpeg|gif|svg|webp|pdf|zip|mp4|mp3)(\?|$)/i.test(abs.pathname)) return null
    return abs
  } catch {
    return null
  }
}

function extractDescFromReaderText(text: string, fallback: string): string {
  const lines = text
    .split(/\n+/)
    .map((l) => l.replace(/^[#*>\-\s]+/, '').trim())
    .filter((l) => l.length > 40)
  for (const line of lines) {
    if (isIrrelevantContent(line, '')) continue
    return line.slice(0, MAX_DESC_CHARS)
  }
  return fallback.slice(0, MAX_DESC_CHARS)
}

async function fetchHtmlFallback(sourceId: string, indexUrl: string): Promise<number> {
  const startMs = Date.now()
  try {
    const res = await fetch(indexUrl, {
      signal: AbortSignal.timeout(12_000),
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none'
      },
    })
    
    let html = ''
    if (!res.ok) {
      if ((res.status === 403 || res.status === 401 || res.status === 503) && process.env.FIRECRAWL_API_KEY) {
        console.info(`[rss] HTML index ${indexUrl} blocked (${res.status}), bypassing via Firecrawl...`)
        try {
          const fcRes = await fetch('https://api.firecrawl.dev/v1/scrape', {
            method: 'POST',
            signal: AbortSignal.timeout(20_000),
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.FIRECRAWL_API_KEY}` },
            body: JSON.stringify({ url: indexUrl, formats: ['html'] })
          })
          if (fcRes.ok) {
            const fcData = await fcRes.json()
            html = fcData.data?.html || ''
          }
        } catch (e) {
          console.warn(`[rss] Firecrawl bypass failed:`, e)
        }
      }
      
      if (!html) {
        console.warn(`[rss] HTML index ${indexUrl} → HTTP ${res.status}`)
        await recordSourceHealth({
          sourceId,
          eventType: 'failure',
          httpStatus: res.status,
          responseTimeMs: Date.now() - startMs,
        })
        return 0
      }
    } else {
      html = await res.text()
    }
    const base = new URL(indexUrl)

    const linkRe = /<a[^>]+href=["']([^"'#][^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi
    let m: RegExpExecArray | null
    const candidates = new Map<string, string>()

    while ((m = linkRe.exec(html)) !== null) {
      const anchorText = stripHtml(m[2])
      if (anchorText.length < 15 || anchorText.length > 300) continue
      if (/^(home|menu|more|previous|next|back|share|contact|about)$/i.test(anchorText)) continue
      const url = isArticleHref(m[1].trim(), base)
      if (!url) continue
      const href = url.toString()
      if (!candidates.has(href)) candidates.set(href, anchorText)
    }

    const topLinks = Array.from(candidates.entries()).slice(0, MAX_ITEMS_PER_SOURCE)
    if (topLinks.length === 0) {
      console.warn(`[rss] HTML fallback: 0 article links on ${indexUrl}`)
      return 0
    }

    const rows: RssRow[] = []

    await Promise.allSettled(
      topLinks.map(async ([link, anchorTitle]) => {
        try {
          const readerText = await readUrlAsText(link)
          let title = anchorTitle
          let description = anchorTitle

          if (readerText && readerText.length > 100) {
            const headingMatch = readerText.match(/^#+\s+(.+)$/m)
            if (headingMatch?.[1] && headingMatch[1].length > 10) {
              title = headingMatch[1].trim().slice(0, 300)
            }
            description = extractDescFromReaderText(readerText, title)
          } else {
            const pageRes = await fetch(link, {
              signal: AbortSignal.timeout(8_000),
              headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
                'Accept': 'application/rss+xml, application/atom+xml, application/xml, text/xml, */*',
                'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
                'Cache-Control': 'no-cache',
                'Pragma': 'no-cache',
                'Sec-Fetch-Dest': 'document',
                'Sec-Fetch-Mode': 'navigate',
                'Sec-Fetch-Site': 'none'
              },
            })
            if (!pageRes.ok) return
            const pageHtml = await pageRes.text()

            const ogTitle =
              pageHtml.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']{10,})["']/i)?.[1] ??
              pageHtml.match(/<meta[^>]+content=["']([^"']{10,})["'][^>]+property=["']og:title["']/i)?.[1]
            const ogDesc =
              pageHtml.match(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']{20,})["']/i)?.[1] ??
              pageHtml.match(/<meta[^>]+content=["']([^"']{20,})["'][^>]+property=["']og:description["']/i)?.[1] ??
              pageHtml.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']{20,})["']/i)?.[1] ??
              pageHtml.match(/<meta[^>]+content=["']([^"']{20,})["'][^>]+name=["']description["']/i)?.[1]

            title = stripHtml(ogTitle ?? anchorTitle).slice(0, 300)
            description = stripHtml(ogDesc ?? anchorTitle).slice(0, MAX_DESC_CHARS)
          }

          if (title.length < 10 || description.length < 20) return
          if (isIrrelevantContent(title, description)) return

          rows.push({
            source_id: sourceId,
            title,
            description,
            link,
            published_at: new Date().toISOString(),
            fullText: readerText && readerText.length > 100 ? readerText : null,
          })
        } catch {
          // per-article timeout or error — skip
        }
      }),
    )

    return saveRows(sourceId, rows, 'html_index')
  } catch (err) {
    console.warn(`[rss] HTML fallback failed for ${indexUrl}:`, getErrorMessage(err))
    await recordSourceHealth({
      sourceId,
      eventType: 'failure',
      errorMessage: getErrorMessage(err),
      responseTimeMs: Date.now() - startMs,
    })
    return 0
  }
}

// ─── Manual sources (pasted text, no feed to poll) ─────────────────────────

export interface ManualItemInput {
  title: string
  content: string
  url?: string | null
}

/**
 * Save a manually-pasted item for a source with source_type = 'manual'.
 * Unlike saveRows (RSS/HTML path), this never calls out to the network:
 * the person supplied the full text directly, so there's nothing to fetch
 * and no snippet-vs-full-text tradeoff — it's full_text from the start.
 */
export async function saveManualItem(sourceId: string, input: ManualItemInput): Promise<{ id: string }> {
  const title = input.title.trim().slice(0, 300)
  const content = input.content.trim()
  if (!title) throw new Error('title is required')
  if (!content) throw new Error('content is required')

  const snippet = content.slice(0, MAX_DESC_CHARS)
  // rss_items.link is UNIQUE but nullable; without a real URL, use a
  // synthetic one so this item still shows up in the legacy /api/market
  // feed (which reads from rss_items) without colliding with a real URL.
  const link = input.url?.trim() || `manual://${sourceId}/${crypto.randomUUID()}`

  const { data: rssRow, error: rssError } = await getSupabaseAdmin()
    .from('rss_items')
    .insert({
      source_id: sourceId,
      title,
      description: snippet,
      link,
      published_at: new Date().toISOString(),
    })
    .select('id')
    .single()

  if (rssError) throw new Error(`Save failed: ${rssError.message}`)

  const evidenceId = await saveEvidence({
    sourceId,
    canonicalUrl: link,
    sourceTitle: title,
    sourceSummary: snippet,
    sourceLanguage: 'pt-BR',
    publishedAt: new Date().toISOString(),
    fullText: content,
    hydrationStatus: 'full_text',
  })

  await recordIngestionRun({
    sourceId,
    connectorType: 'manual',
    itemsDiscovered: 1,
    itemsSaved: 1,
    success: true,
  })
  await recordSourceHealth({ sourceId, eventType: 'success', itemsYielded: 1 })

  return { id: rssRow?.id ?? evidenceId }
}

// ─── Public entry point ───────────────────────────────────────────────────────

export async function fetchAndSaveRss(
  sourceId: string,
  url: string,
  sourceType: ConnectorType | string = 'rss',
): Promise<number> {
  const startMs = Date.now()

  // Manual sources have no feed to poll — content comes in via saveManualItem
  // (POST /api/rss/[id]/manual-item). Treat as a no-op success, not a failure:
  // there being zero *new* items from polling is expected, not a health event.
  if (sourceType === 'manual') {
    return 0
  }

  // html_index goes directly to scraper
  if (sourceType === 'html_index') {
    return fetchHtmlFallback(sourceId, url)
  }

  // PubMed gated
  if ((url.startsWith('pubmed:') || url.includes('pubmed.ncbi') || url.includes('ncbi.nlm.nih.gov')) && isFeatureEnabled('pubMedEnabled')) {
    const hint = url.startsWith('pubmed:') ? url.slice('pubmed:'.length) : 'mental_health'
    return fetchPubMed(sourceId, hint || 'mental_health')
  }

  try {
    const feed = await parser.parseURL(url)
    const rows: RssRow[] = []

    for (const item of feed.items.slice(0, 20)) {
      const title = stripHtml(item.title)
      if (title.length < 15 || !item.link) continue

      const rawDesc = String(
        item.contentSnippet ??
        item.content ??
        item.summary ??
        (item as Record<string, unknown>)['content:encodedSnippet'] ??
        '',
      )
      const description = stripHtml(rawDesc).slice(0, MAX_DESC_CHARS) || title

      if (isIrrelevantContent(title, description)) {
        console.info(`[rss] skipping irrelevant: "${title.slice(0, 60)}"`)
        continue
      }

      rows.push({
        source_id: sourceId,
        title,
        description,
        link: item.link,
        published_at: item.pubDate ? new Date(item.pubDate).toISOString() : new Date().toISOString(),
      })

      if (rows.length >= MAX_ITEMS_PER_SOURCE) break
    }

    if (rows.length > 0) {
      console.info(`[rss] RSS OK — ${url} — ${rows.length} items`)
      return saveRows(sourceId, rows, sourceType)
    }

    console.warn(`[rss] RSS empty for ${url} — skipping HTML fallback`)
    return 0
  } catch (err) {
    console.warn(`[rss] RSS parse failed for ${url}: ${getErrorMessage(err)}`)
    await recordSourceHealth({
      sourceId,
      eventType: 'failure',
      errorMessage: getErrorMessage(err),
      responseTimeMs: Date.now() - startMs,
    })
    return fetchHtmlFallback(sourceId, url)
  }
}

/**
 * Get recent RSS items for context injection.
 * Stage 2: Reads from evidence_items when available, falls back to rss_items.
 */
export async function getRecentRssItems(topic: string, limit = 5): Promise<string> {
  // Try evidence_items first
  const { data: evidenceData } = await getSupabaseAdmin()
    .from('evidence_items')
    .select('source_title, source_summary, source_language')
    .order('discovered_at', { ascending: false })
    .limit(60)

  const data = evidenceData && evidenceData.length > 0 
    ? evidenceData.map(item => ({
        title: item.source_title,
        description: item.source_summary,
        source_language: item.source_language,
      }))
    : await getSupabaseAdmin()
        .from('rss_items')
        .select('title, description, source_language')
        .order('collected_at', { ascending: false })
        .limit(60)
        .then(r => r.data ?? [])

  if (!data || data.length === 0) return ''

  const keywords = topic.toLowerCase().split(/\s+/).filter((w) => w.length > 3)
  const filtered = keywords.length > 0
    ? data.filter((item) => {
        const text = `${item.title ?? ''} ${item.description ?? ''}`.toLowerCase()
        return keywords.some((kw) => text.includes(kw))
      })
    : data

  return (filtered.length > 0 ? filtered : data)
    .slice(0, limit)
    .map((item) => `• ${item.title ?? ''}: ${(item.description ?? '').slice(0, 200)}`)
    .join('\n')
}