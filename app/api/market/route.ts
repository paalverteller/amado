/**
 * app/api/market/route.ts
 * 
 * Stage 2: Evidence-first market feed.
 * Returns source content directly — no Russian translation gate.
 * Backward compatible: UI expects title_ru/summary_ru fields.
 */
 import { NextResponse } from 'next/server'
 import { getSupabaseAdmin } from '@/lib/supabase'

 export const dynamic = 'force-dynamic'

 const MAX_TOTAL = 100
 const MAX_PER_SOURCE = 6

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

 export async function GET(): Promise<NextResponse> {
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
     return NextResponse.json({ error: (err as Error).message }, { status: 500 })
   }
 }
