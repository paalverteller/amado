'use client'

import { t } from '@/lib/i18n/config'
import type { CompetitorMentionSource } from '@/lib/domain/observability'

interface CompetitorMentionsCardProps {
  sources: CompetitorMentionSource[]
  competitorsScanned: number
  windowDays: number
}

const MAX_SHOWN = 5

export default function CompetitorMentionsCard({ sources, competitorsScanned, windowDays }: CompetitorMentionsCardProps) {
  if (competitorsScanned === 0) return null

  const withMentions = sources.filter((source) => source.mentionCount > 0).slice(0, MAX_SHOWN)

  return (
    <div className="m3-card space-y-2 p-4">
      <p className="text-sm font-semibold text-on-surface">{t('settings.competitor_mentions_title')}</p>
      <p className="text-xs text-on-surface-variant">
        {t('settings.competitor_mentions_subtitle')} ({windowDays} {t('settings.low_value_days')})
      </p>

      {withMentions.length === 0 ? (
        <p className="text-xs text-on-surface-variant">{t('settings.competitor_mentions_none')}</p>
      ) : (
        <ul className="space-y-1">
          {withMentions.map((source) => (
            <li key={source.id} className="flex items-center justify-between gap-3 text-sm text-on-surface">
              <span className="truncate">{source.name}</span>
              <span className="shrink-0 text-xs text-on-surface-variant">
                {source.mentionCount} · {source.competitorsCovered}/{competitorsScanned}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
