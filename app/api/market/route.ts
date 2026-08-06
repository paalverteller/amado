import { getErrorMessage } from '@/lib/api/error-message'
/**
 * app/api/market/route.ts
 * 
 * Stage 2: Evidence-first market feed.
 * Returns source content directly — no Russian translation gate.
 * Backward compatible: UI expects title_ru/summary_ru fields.
 *
 * ?q=<term> switches to full-content search over evidence_items (title,
 * summary, and full_text when hydrated) instead of the default 14-day feed.
 */
 import { NextRequest, NextResponse } from 'next/server'
 import { getSupabaseAdmin } from '@/lib/supabase/client'
 export const dynamic = 'force-dynamic'

 const MAX_TOTAL = 100
 const MAX_PER_SOURCE = 6
 const MAX_SEARCH_RESULTS = 50
 const MAX_SEARCH_PER_QUERY = 30

 type Src = { name?: string | null; url?: string | null; country?: string | null; source_type?: string | null }
 type Row = {
   id: string
   title: string | null
   description: string | null
   link: string | null
   published_at: string | null
   collected_at: string | null
   source: Src | Src[] | null
 }
 type Item = Row & { title_ru: string; summary_ru: string; source: Src | null }

 function normSrc(s: Row['source']): Src | null { return Array.isArray(s) ? s[0] ?? null : s }
 function clean(v: string | null | undefined): string { return (v ?? '').replace(/\s+/g, ' ').trim() }
 function srcKey(s: Src | null): string { return s?.url ?? s?.name ?? 'unknown' }
 function itemTs(r: Row): number { const raw = r.published_at ?? r.collected_at; const t = raw ? Date.parse(raw) : 0; return Number.isFinite(t) ? t : 0 }

 function toItem(row: Row): Item | null {
   const source = normSrc(row.source)
   const title = clean(row.title)
   const description = clean(row.description)
   
   // Stage 2: Source content is the display content
   const displayTitle = title || 'Untitled'
   const displaySummary = description || ''
   
   // Filter: require at least a title
   if (!displayTitle || displayTitle === 'Untitled') return null
   
   // Filter: 14-day window (configurable)
   const ts = itemTs(row)
   if (ts > 0 && Date.now() - ts > 14 * 24 * 60 * 60 * 1000) return null

   return {
     ...row,
     title_ru: displayTitle,
     summary_ru: displaySummary,
     source,
   }
 }

 function rank(item: Item): number {
   return itemTs(item)
 }

 function pick(available: Item[]): Item[] {
   const counts = new Map<string, number>()
   const out: Item[] = []
   for (const item of available) {
     if (out.length >= MAX_TOTAL) break
     const k = srcKey(item.source)
     const c = counts.get(k) ?? 0
     if (c >= MAX_PER_SOURCE) continue
     out.push(item)
     counts.set(k, c + 1)
   }
   return out
 }

 type EvidenceRow = {
   id: string
   source_title: string | null
   source_summary: string | null
   full_text: string | null
   canonical_url: string | null
   published_at: string | null
   created_at: string | null
   hydration_status: string | null
   source: Src | Src[] | null
 }

 async function searchEvidence(rawQuery: string): Promise<NextResponse> {
   try {
     const term = rawQuery.trim().slice(0, 200)
     if (!term) return NextResponse.json({ items: [], meta: { total: 0, query: rawQuery } })

     // Escape LIKE/ILIKE wildcards so a literal % or _ typed by the person
     // is searched for literally, not treated as a wildcard.
     const pattern = `%${term.replace(/[%_]/g, '\\$&')}%`
     const columns = 'id, source_title, source_summary, full_text, canonical_url, published_at, created_at, hydration_status, source:source_id(name, url, country, source_type)'

     // Three separate ilike() queries + merge in JS, rather than building a
     // raw .or() filter string -- avoids the person's search term needing
     // escaping against PostgREST's comma/paren-delimited filter syntax on
     // top of SQL's own escaping. Each ilike() call is safely parameterized
     // by supabase-js on its own.
     const [byTitle, bySummary, byFullText] = await Promise.all([
       getSupabaseAdmin().from('evidence_items').select(columns).ilike('source_title', pattern).order('published_at', { ascending: false }).limit(MAX_SEARCH_PER_QUERY),
       getSupabaseAdmin().from('evidence_items').select(columns).ilike('source_summary', pattern).order('published_at', { ascending: false }).limit(MAX_SEARCH_PER_QUERY),
       getSupabaseAdmin().from('evidence_items').select(columns).ilike('full_text', pattern).order('published_at', { ascending: false }).limit(MAX_SEARCH_PER_QUERY),
     ])

     for (const result of [byTitle, bySummary, byFullText]) {
       if (result.error) return NextResponse.json({ error: result.error.message }, { status: 500 })
     }

     const byId = new Map<string, EvidenceRow>()
     for (const result of [byTitle.data, bySummary.data, byFullText.data]) {
       for (const row of (result ?? []) as unknown as EvidenceRow[]) byId.set(row.id, row)
     }

     const lowerTerm = term.toLowerCase()
     const items = Array.from(byId.values())
       .sort((a, b) => {
         const tsA = Date.parse(a.published_at ?? a.created_at ?? '') || 0
         const tsB = Date.parse(b.published_at ?? b.created_at ?? '') || 0
         return tsB - tsA
       })
       .slice(0, MAX_SEARCH_RESULTS)
       .map(row => ({
         id: row.id,
         title_ru: clean(row.source_title),
         summary_ru: clean(row.source_summary ?? ''),
         link: row.canonical_url,
         published_at: row.published_at,
         collected_at: row.created_at,
         hydrationStatus: row.hydration_status,
         matchedInFullText: Boolean(row.full_text?.toLowerCase().includes(lowerTerm)),
         source: normSrc(row.source),
       }))

     return NextResponse.json({ items, meta: { total: items.length, query: term } })
   } catch (err) {
     return NextResponse.json({ error: getErrorMessage(err) }, { status: 500 })
   }
 }

 export async function GET(request: NextRequest): Promise<NextResponse> {
   const q = request.nextUrl.searchParams.get('q')
   if (q && q.trim()) return searchEvidence(q)

   try {
     const { data, error } = await getSupabaseAdmin()
       .from('rss_items')
       .select('id, title, description, link, published_at, collected_at, source:source_id(name, url, country, source_type)')
       .order('collected_at', { ascending: false })
       .limit(500)

     if (error) return NextResponse.json({ error: error.message }, { status: 500 })

     const available = ((data ?? []) as Row[])
       .map(toItem).filter((i): i is Item => i !== null)
       .sort((a, b) => rank(b) - rank(a))

     const items = pick(available)

     return NextResponse.json({
       items,
       meta: {
         total: items.length,
         available: available.length,
         maxTotal: MAX_TOTAL,
         maxPerSource: MAX_PER_SOURCE,
         sources: items.reduce<Record<string, number>>((acc, i) => {
           const n = i.source?.name ?? 'Unknown'; acc[n] = (acc[n] ?? 0) + 1; return acc
         }, {}),
       },
     })
   } catch (err) {
     return NextResponse.json({ error: getErrorMessage(err) }, { status: 500 })
   }
 }