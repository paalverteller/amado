import { getSupabaseAdmin } from '@/lib/supabase/client'
import { generateArticleWithFallback } from '@/lib/ai'
import { getErrorMessage } from '@/lib/api/error-message'

export interface HypothesisResult {
  status: 'ready' | 'failed'
  hypothesis?: string
  model?: string
  error?: string
}

const METRIC_LABELS: Record<string, string> = {
  reach: 'охват', impressions: 'показы', followers: 'подписчики',
  non_follower_reach: 'охват не-подписчиков', saves: 'сохранения',
  shares: 'репосты', replies: 'ответы', comments: 'комментарии', likes: 'лайки',
  watch_time_seconds: 'время просмотра (сек)', retention_rate: 'удержание',
  rewatches: 'повторные просмотры', profile_visits: 'визиты в профиль',
  dms: 'сообщения в директ', whatsapp_starts: 'переходы в WhatsApp',
  link_clicks: 'клики по ссылке',
}

/**
 * Generates a labeled AI hypothesis for why a piece of content performed
 * the way its recorded metrics show. Always a guess about correlation,
 * explicitly not a causal claim -- the prompt is written to produce
 * hedged, falsifiable language, and the caller must present the result
 * as "Предположение AI" (AI hypothesis), never as fact. Never writes to
 * any brand_* governance table -- that's a separate, human-triggered
 * explicit-signal path (see app/api/brands/[brandId]/learning/route.ts).
 */
export async function generatePerformanceHypothesis(snapshotId: string): Promise<HypothesisResult> {
  const admin = getSupabaseAdmin()

  const { data: snapshot, error: snapshotError } = await admin
    .from('performance_snapshots')
    .select('*, article:article_id (topic, content_type, draft_content, final_content)')
    .eq('id', snapshotId)
    .single()

  if (snapshotError || !snapshot) {
    return { status: 'failed', error: snapshotError?.message ?? 'Snapshot not found' }
  }

  const article = Array.isArray(snapshot.article) ? snapshot.article[0] : snapshot.article
  const contentPreview = (article?.final_content || article?.draft_content || '').slice(0, 800)

  const metricLines = Object.entries(METRIC_LABELS)
    .map(([key, label]) => (snapshot[key] != null ? `- ${label}: ${snapshot[key]}` : null))
    .filter(Boolean)

  if (metricLines.length === 0 && !snapshot.qualitative_notes) {
    return { status: 'failed', error: 'No metrics recorded for this snapshot yet' }
  }

  const systemPrompt = [
    'Ты аналитик, который помогает маркетинговой команде понять результаты публикации.',
    'Тебе даны метрики одной публикации и, возможно, текст контента.',
    '',
    'Напиши 2-4 предложения на РУССКОМ языке с ГИПОТЕЗОЙ о том, что могло повлиять на эти результаты.',
    'Обязательно используй формулировки-хеджи: "возможно", "похоже, что", "может быть связано с" —',
    'никогда не утверждай причину как установленный факт. У тебя нет данных для этого, только корреляция',
    'по одной публикации. Если метрик мало или они неоднозначны — честно скажи, что данных недостаточно',
    'для содержательной гипотезы, и не выдумывай.',
  ].join('\n')

  const userPrompt = [
    article?.topic ? `Тема: ${article.topic}` : null,
    article?.content_type ? `Тип контента: ${article.content_type}` : null,
    `Платформа: ${snapshot.platform}`,
    `Горизонт измерения: ${snapshot.horizon}`,
    metricLines.length ? `Метрики:\n${metricLines.join('\n')}` : null,
    snapshot.qualitative_notes ? `Заметки команды: ${snapshot.qualitative_notes}` : null,
    contentPreview ? `Текст контента (начало):\n${contentPreview}` : null,
  ].filter(Boolean).join('\n\n')

  try {
    const result = await generateArticleWithFallback({ systemPrompt, userPrompt, maxTokens: 400 })

    await admin.from('performance_snapshots').update({
      ai_hypothesis: result.text.trim(),
      ai_hypothesis_model: result.model,
      ai_hypothesis_generated_at: new Date().toISOString(),
    }).eq('id', snapshotId)

    return { status: 'ready', hypothesis: result.text.trim(), model: result.model }
  } catch (err) {
    return { status: 'failed', error: getErrorMessage(err) }
  }
}
