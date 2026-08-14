import { getSupabaseAdmin } from '@/lib/supabase/client'
import { classifyContentPattern, type PatternArticle, type PatternPillar } from '@/lib/content-patterns'

export interface PerformanceSnapshotRow {
  id: string
  article_id: string | null
  platform: string
  horizon: string
  reach: number | null
  impressions: number | null
  saves: number | null
  shares: number | null
  replies: number | null
  comments: number | null
  likes: number | null
  dms: number | null
  whatsapp_starts: number | null
  link_clicks: number | null
  recorded_at: string
  article: PatternArticle | PatternArticle[] | null
}

export interface InsightDimensionItem {
  key: string
  label: string
  sampleSize: number
  score: number | null
  explanation: string
}

export interface FatigueFinding {
  dimension: 'hook' | 'cta' | 'topic' | 'length' | 'format' | 'platform'
  value: string
  occurrences: number
  window: number
  ratio: number
  explanation: string
}

export interface MarketingInsights {
  brandId: string | null
  sampleSize: number
  scoredSampleSize: number
  metricDefinition: string
  dimensions: {
    hooks: InsightDimensionItem[]
    themes: InsightDimensionItem[]
    pillars: InsightDimensionItem[]
    ctas: InsightDimensionItem[]
    lengths: InsightDimensionItem[]
    formats: InsightDimensionItem[]
    platforms: InsightDimensionItem[]
  }
  fatigue: FatigueFinding[]
  recommendations: string[]
  generatedAt: string
}

type Scored = {
  snapshot: PerformanceSnapshotRow
  article: PatternArticle
  score: number | null
  pattern: ReturnType<typeof classifyContentPattern>
}

const LABELS: Record<string, string> = {
  question: 'Вопрос', data: 'Данные/цифра', direct_address: 'Обращение к читателю', command: 'Императив', contrast: 'Контраст', statement: 'Утверждение',
  whatsapp: 'WhatsApp', link: 'Переход по ссылке', comment: 'Комментарий', share: 'Поделиться', save: 'Сохранить', register: 'Регистрация', demo: 'Демо', learn_more: 'Узнать больше', none: 'Без явного CTA',
  micro: 'До 300 знаков', short: '301–900 знаков', medium: '901–1800 знаков', long: 'Более 1800 знаков',
  article: 'Статья', linkedin_post: 'LinkedIn', instagram_caption: 'Instagram — подпись', instagram_carousel: 'Instagram — карусель',
  x_thread: 'X — тред', facebook_post: 'Facebook', telegram_post: 'Telegram', short_video_script: 'Короткое видео', email: 'Email', quick_note: 'Короткая заметка',
  social_post: 'Социальный пост (legacy)', thread: 'Тред (legacy)', carousel: 'Карусель (legacy)', note: 'Заметка (legacy)', unknown: 'Не определён',
}

function firstArticle(value: PerformanceSnapshotRow['article']): PatternArticle | null {
  if (!value) return null
  return Array.isArray(value) ? (value[0] ?? null) : value
}

/**
 * Explainable performance score. Only snapshots with reach/impressions are
 * scored, because comparing raw engagement counts across differently-sized
 * audiences is misleading. High-intent actions get a larger weight.
 */
export function calculatePerformanceScore(snapshot: PerformanceSnapshotRow): number | null {
  const denominator = snapshot.reach && snapshot.reach > 0
    ? snapshot.reach
    : snapshot.impressions && snapshot.impressions > 0
      ? snapshot.impressions
      : null
  if (!denominator) return null

  const weighted =
    (snapshot.likes ?? 0) +
    (snapshot.comments ?? 0) * 2 +
    (snapshot.replies ?? 0) * 2 +
    (snapshot.saves ?? 0) * 3 +
    (snapshot.shares ?? 0) * 3 +
    (snapshot.link_clicks ?? 0) * 4 +
    (snapshot.dms ?? 0) * 4 +
    (snapshot.whatsapp_starts ?? 0) * 4

  return weighted / denominator
}

function aggregate(rows: Scored[], valueOf: (row: Scored) => string | null): InsightDimensionItem[] {
  const groups = new Map<string, { scores: number[]; count: number }>()
  for (const row of rows) {
    const key = valueOf(row)
    if (!key) continue
    const group = groups.get(key) ?? { scores: [], count: 0 }
    group.count += 1
    if (row.score !== null) group.scores.push(row.score)
    groups.set(key, group)
  }

  return Array.from(groups.entries())
    .map(([key, group]) => {
      const score = group.scores.length
        ? group.scores.reduce((sum, n) => sum + n, 0) / group.scores.length
        : null
      return {
        key,
        label: LABELS[key] ?? key,
        sampleSize: group.count,
        score,
        explanation: score === null
          ? `Есть ${group.count} публикац., но нет reach/impressions для честного сравнения.`
          : `Средний взвешенный engagement ${(score * 100).toFixed(2)}% по ${group.scores.length} публикац. с reach/impressions.`,
      }
    })
    .sort((a, b) => {
      if (a.score === null && b.score === null) return b.sampleSize - a.sampleSize
      if (a.score === null) return 1
      if (b.score === null) return -1
      return b.score - a.score
    })
}

function detectFatigue(rows: Scored[], windowSize = 10): FatigueFinding[] {
  const recent = rows.slice(0, windowSize)
  if (recent.length < 4) return []

  const dimensions: Array<[FatigueFinding['dimension'], (row: Scored) => string]> = [
    ['hook', (r) => r.pattern.hookType],
    ['cta', (r) => r.pattern.ctaType],
    ['topic', (r) => r.pattern.topicKey],
    ['length', (r) => r.pattern.lengthBucket],
    ['format', (r) => r.pattern.contentFormat],
    ['platform', (r) => r.snapshot.platform],
  ]

  const findings: FatigueFinding[] = []
  for (const [dimension, getter] of dimensions) {
    const counts = new Map<string, number>()
    for (const row of recent) counts.set(getter(row), (counts.get(getter(row)) ?? 0) + 1)
    const [value, occurrences] = Array.from(counts.entries()).sort((a, b) => b[1] - a[1])[0] ?? ['', 0]
    const ratio = occurrences / recent.length
    if (occurrences >= 3 && ratio >= 0.5) {
      findings.push({
        dimension,
        value,
        occurrences,
        window: recent.length,
        ratio,
        explanation: `${LABELS[value] ?? value} повторяется в ${occurrences} из ${recent.length} последних публикаций (${Math.round(ratio * 100)}%). Это сигнал однообразия, а не доказанная причина падения результата.`,
      })
    }
  }
  return findings
}

function topReliable(items: InsightDimensionItem[]): InsightDimensionItem | null {
  return items.find((item) => item.score !== null && item.sampleSize >= 2) ?? null
}

function bottomReliable(items: InsightDimensionItem[]): InsightDimensionItem | null {
  return [...items].reverse().find((item) => item.score !== null && item.sampleSize >= 2) ?? null
}

export function buildMarketingInsights(params: {
  brandId: string | null
  snapshots: PerformanceSnapshotRow[]
  pillars: PatternPillar[]
}): MarketingInsights {
  // Keep one latest snapshot per article+platform so a 3h/24h/7d sequence
  // does not count one piece as several independent publications.
  const latest = new Map<string, PerformanceSnapshotRow>()
  for (const snapshot of params.snapshots) {
    if (!snapshot.article_id) continue
    const key = `${snapshot.article_id}:${snapshot.platform}`
    if (!latest.has(key)) latest.set(key, snapshot)
  }

  const rows: Scored[] = []
  for (const snapshot of latest.values()) {
    const article = firstArticle(snapshot.article)
    if (!article) continue
    rows.push({
      snapshot,
      article,
      score: calculatePerformanceScore(snapshot),
      pattern: classifyContentPattern(article, params.pillars),
    })
  }

  const dimensions = {
    hooks: aggregate(rows, (r) => r.pattern.hookType),
    themes: aggregate(rows, (r) => r.pattern.topicKey),
    pillars: aggregate(rows, (r) => r.pattern.pillarName ?? 'Не определён'),
    ctas: aggregate(rows, (r) => r.pattern.ctaType),
    lengths: aggregate(rows, (r) => r.pattern.lengthBucket),
    formats: aggregate(rows, (r) => r.pattern.contentFormat),
    platforms: aggregate(rows, (r) => r.snapshot.platform),
  }

  const fatigue = detectFatigue(rows)
  const scoredSampleSize = rows.filter((r) => r.score !== null).length
  const recommendations: string[] = []

  if (scoredSampleSize < 3) {
    recommendations.push('Для сравнительной аналитики пока мало данных: внесите reach или impressions минимум для 3 опубликованных материалов.')
  } else {
    const topHook = topReliable(dimensions.hooks)
    const bottomHook = bottomReliable(dimensions.hooks)
    if (topHook && bottomHook && topHook.key !== bottomHook.key && topHook.score !== null && bottomHook.score !== null) {
      recommendations.push(`Протестируйте больше открытий типа «${topHook.label}»: в текущей выборке их средний взвешенный engagement выше, чем у «${bottomHook.label}». Это корреляция, не причинный вывод.`)
    }
    const topPlatform = topReliable(dimensions.platforms)
    if (topPlatform) recommendations.push(`Площадка с самым сильным текущим сигналом — ${topPlatform.label}. Сохраняйте сопоставимый формат и цель при следующем тесте.`)
    const topCta = topReliable(dimensions.ctas)
    if (topCta) recommendations.push(`CTA «${topCta.label}» сейчас лидирует среди вариантов с повторной выборкой; проверьте его ещё на 2–3 публикациях перед закреплением.`)
  }

  for (const finding of fatigue.slice(0, 3)) {
    recommendations.push(`Разнообразьте ${finding.dimension}: ${finding.explanation}`)
  }

  return {
    brandId: params.brandId,
    sampleSize: rows.length,
    scoredSampleSize,
    metricDefinition: 'Взвешенный engagement = (likes + 2×comments/replies + 3×saves/shares + 4×clicks/DM/WhatsApp) ÷ reach; если reach нет — ÷ impressions.',
    dimensions,
    fatigue,
    recommendations: recommendations.slice(0, 6),
    generatedAt: new Date().toISOString(),
  }
}

export async function resolveDefaultBrandId(requested?: string | null): Promise<string | null> {
  if (requested) return requested
  const { data } = await getSupabaseAdmin()
    .from('brand_profiles')
    .select('id')
    .eq('is_active', true)
    .order('is_default', { ascending: false })
    .limit(1)
    .maybeSingle()
  return data?.id ?? null
}

export async function loadMarketingInsights(brandId?: string | null): Promise<MarketingInsights> {
  const admin = getSupabaseAdmin()
  const resolvedBrandId = await resolveDefaultBrandId(brandId)

  let perfQuery = admin
    .from('performance_snapshots')
    .select(`
      id, article_id, platform, horizon, reach, impressions, saves, shares, replies, comments, likes,
      dms, whatsapp_starts, link_clicks, recorded_at,
      article:article_id (id, topic, content_type, draft_content, final_content, char_count, brand_profile_id, content_request_id, request:content_request_id(content_format))
    `)
    .not('article_id', 'is', null)
    .order('recorded_at', { ascending: false })
    .limit(300)

  if (resolvedBrandId) perfQuery = perfQuery.eq('brand_id', resolvedBrandId)

  const [{ data: snapshots, error: perfError }, pillarResult] = await Promise.all([
    perfQuery,
    resolvedBrandId
      ? admin.from('brand_content_pillars').select('id, name, purpose').eq('brand_id', resolvedBrandId).eq('active', true)
      : Promise.resolve({ data: [] as PatternPillar[], error: null }),
  ])

  if (perfError) throw new Error(perfError.message)
  if (pillarResult.error) throw new Error(pillarResult.error.message)

  return buildMarketingInsights({
    brandId: resolvedBrandId,
    snapshots: (snapshots ?? []) as unknown as PerformanceSnapshotRow[],
    pillars: (pillarResult.data ?? []) as PatternPillar[],
  })
}
