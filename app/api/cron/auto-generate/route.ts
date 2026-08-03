import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/client'
import { buildSystemPrompt, buildUserPrompt } from '@/lib/prompts'
import { generateArticleWithFallback } from '@/lib/ai'
import { cleanPlainTextOutput } from '@/lib/text-cleanup'
import { requireCronAuth } from '@/lib/cron-auth'
import { CRON_CONFIG } from '@/lib/amado-config'
import { mapToLegacyContentType } from '@/lib/content-formats'
import { getErrorMessage } from '@/lib/api/error-message'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const THROTTLE_HOURS = CRON_CONFIG.autoGenerateThrottleHours
const STATE_KEY = 'auto_generate_last_run'

export async function GET(request: Request): Promise<NextResponse> {
  const denied = requireCronAuth(request)
  if (denied) return denied

  try {
    const admin = getSupabaseAdmin()

    // ── Self-throttle: only proceed if >= N hours since last successful run ──────
    const { data: stateRow } = await admin
      .from('cron_state')
      .select('last_run_at')
      .eq('key', STATE_KEY)
      .maybeSingle()

    const lastRun = stateRow?.last_run_at ? new Date(stateRow.last_run_at).getTime() : 0
    const hoursSince = (Date.now() - lastRun) / (1000 * 60 * 60)

    if (lastRun && hoursSince < THROTTLE_HOURS) {
      return NextResponse.json({
        status: 'skipped',
        reason: `Only ${hoursSince.toFixed(1)}h since last run, need ${THROTTLE_HOURS}h`,
      })
    }

    // ── Pick a random book chunk (same source as /ideas page) ────────────────
    let chunk: { book_id: string; book_title: string; content: string } | null = null
    const { data: rpcData, error: rpcError } = await admin.rpc('get_random_book_chunk')
    if (!rpcError && rpcData?.length) {
      chunk = rpcData[0]
    } else {
      const { data: directData } = await admin
        .from('book_chunks')
        .select('book_id, book_title, content')
        .limit(1)
      chunk = directData?.[0] ?? null
    }

    if (!chunk) {
      return NextResponse.json({ error: 'No book chunks available for auto-generation' }, { status: 404 })
    }

    const topic = chunk.content.slice(0, 300).replace(/\s+/g, ' ').trim()

    const built = await buildSystemPrompt()
    const systemPrompt = `${built.systemPrompt}\n\nSTRICT OUTPUT FORMAT:\nWrite only the final clean text for publication. No think tags. No Markdown.`
    const userPrompt = buildUserPrompt({ topic, format: 'article' })

    const generated = await generateArticleWithFallback({ systemPrompt, userPrompt })
    const cleanText = cleanPlainTextOutput(generated.text)

    // Use first line as display topic if it looks like a title
    const lines = cleanText.split(/\n\s*\n/).map(l => l.trim()).filter(Boolean)
    const displayTopic = (lines[0] && lines[0].length <= 140) ? lines[0] : topic.slice(0, 140)

    const { data: inserted, error: insertError } = await admin
      .from('articles')
      .insert({
        topic: displayTopic,
        content_type: mapToLegacyContentType('article'),
        draft_content: cleanText,
        status: 'draft',
        source_context: null,
      })
      .select('id')
      .single()

    if (insertError) throw new Error(insertError.message)

    await admin
      .from('cron_state')
      .upsert({ key: STATE_KEY, last_run_at: new Date().toISOString() }, { onConflict: 'key' })

    return NextResponse.json({
      status: 'ok',
      articleId: inserted?.id,
      topic: displayTopic,
      bookSource: chunk.book_title,
    })
  } catch (err) {
    console.error('[cron/auto-generate] error:', err)
    return NextResponse.json({ error: getErrorMessage(err) }, { status: 500 })
  }
}
