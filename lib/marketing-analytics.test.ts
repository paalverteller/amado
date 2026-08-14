import { describe, expect, it } from 'vitest'
import { buildMarketingInsights, calculatePerformanceScore, type PerformanceSnapshotRow } from './marketing-analytics'

function snapshot(id: string, articleId: string, platform: string, recordedAt: string, hookText: string, reach = 1000, likes = 10): PerformanceSnapshotRow {
  return {
    id, article_id: articleId, platform, horizon: '24h', reach, impressions: null,
    saves: 2, shares: 1, replies: 0, comments: 2, likes, dms: 0, whatsapp_starts: 0, link_clicks: 3,
    recorded_at: recordedAt,
    article: {
      id: articleId, topic: 'Automação CRM Brasil', content_type: 'social_post', draft_content: hookText,
      final_content: null, char_count: hookText.length, brand_profile_id: 'brand', request: { content_format: 'linkedin_post' },
    },
  }
}

describe('marketing analytics', () => {
  it('uses an explainable weighted engagement denominator', () => {
    const row = snapshot('s1', 'a1', 'linkedin', '2026-08-14T10:00:00Z', '37% das equipes perdem tempo. Saiba mais.')
    expect(calculatePerformanceScore(row)).toBeCloseTo((10 + 2 * 2 + 2 * 3 + 1 * 3 + 3 * 4) / 1000)
  })

  it('deduplicates horizons and flags repeated patterns as fatigue, not causation', () => {
    const rows = [
      snapshot('s5', 'a5', 'linkedin', '2026-08-14T15:00:00Z', 'Você ainda faz isso manualmente? Saiba mais.'),
      snapshot('s4', 'a4', 'linkedin', '2026-08-14T14:00:00Z', 'Você ainda perde tempo? Saiba mais.'),
      snapshot('s3', 'a3', 'linkedin', '2026-08-14T13:00:00Z', 'Você conhece esse problema? Saiba mais.'),
      snapshot('s2', 'a2', 'linkedin', '2026-08-14T12:00:00Z', 'Você já automatizou isso? Saiba mais.'),
      snapshot('s1-new', 'a1', 'linkedin', '2026-08-14T11:00:00Z', 'Você mede esse gargalo? Saiba mais.'),
      { ...snapshot('s1-old', 'a1', 'linkedin', '2026-08-14T09:00:00Z', '37% das equipes. Saiba mais.'), horizon: '3h' },
    ]
    const insights = buildMarketingInsights({ brandId: 'brand', snapshots: rows, pillars: [] })
    expect(insights.sampleSize).toBe(5)
    expect(insights.fatigue.some((finding) => finding.dimension === 'hook')).toBe(true)
    expect(insights.fatigue[0].explanation).toContain('не доказанная причина')
    expect(insights.metricDefinition).toContain('Взвешенный engagement')
  })
})
