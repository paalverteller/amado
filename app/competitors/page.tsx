'use client'

import Layout from '@/components/Layout'
import { t } from '@/lib/i18n/config'

// Scaffolding for a later phase of the lean plan — kept intentionally thin
// so the route/nav entry exists and is reviewable now, without pretending
// the feature (RAG search / competitor tracking) is already built.

export default function CompetitorsPage() {
  return (
    <Layout>
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--v2-color-text-primary)' }}>
            {t('competitors.title')}
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--v2-color-text-secondary)' }}>
            {t('competitors.subtitle')}
          </p>
        </div>

        <div
          className="rounded-lg border p-8 text-center flex flex-col items-center gap-2"
          style={{ borderColor: 'var(--v2-color-border-default)', background: 'var(--v2-color-surface-base)' }}
        >
          <span
            className="inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold"
            style={{ background: '#DBEAFE', color: '#1E40AF' }}
          >
            {t('status.scheduled')}
          </span>
          <h2 className="text-base font-semibold mt-2" style={{ color: 'var(--v2-color-text-primary)' }}>
            {t('competitors.coming_soon_title')}
          </h2>
          <p className="text-sm max-w-md" style={{ color: 'var(--v2-color-text-secondary)' }}>
            {t('competitors.coming_soon_body')}
          </p>
        </div>
      </div>
    </Layout>
  )
}
