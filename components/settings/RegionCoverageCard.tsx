'use client'

import { t } from '@/lib/i18n/config'
import type { RegionCoverage } from '@/lib/domain/observability'

interface RegionCoverageCardProps {
  coverage: RegionCoverage | undefined
}

export default function RegionCoverageCard({ coverage }: RegionCoverageCardProps) {
  if (!coverage) return null

  return (
    <div className="m3-card flex flex-wrap items-center gap-x-6 gap-y-2 p-4 text-sm">
      <span className="font-semibold text-on-surface">{t('settings.region_coverage_title')}</span>
      <span className="text-on-surface-variant">
        {coverage.totalSources} {t('settings.region_coverage_sources')}
      </span>
      <span className="text-on-surface-variant">
        {coverage.activeSources} {t('settings.region_coverage_active')}
      </span>
      <span className="text-on-surface-variant">
        {coverage.healthySources} {t('settings.region_coverage_healthy')}
      </span>
      <span className="text-on-surface-variant">
        {coverage.evidenceYield30d} {t('settings.region_coverage_yield')}
      </span>
    </div>
  )
}
