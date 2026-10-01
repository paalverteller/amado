/* eslint-disable react-hooks/set-state-in-effect -- guard-clause reset-and-return
 * on a not-yet-selected brand is a confirmed false positive, not a
 * cascading-render bug: see https://github.com/facebook/react/issues/34743
 * and docs/AMADO_ROADMAP.md item 0. */
'use client'

import { useEffect, useState } from 'react'

interface StructuredTableCount {
  table: string
  count: number | null
  error: string | null
}

interface BrandCoverage {
  id: string
  name: string
  emptyProfileFields: string[]
  filledProfileFieldCount: number
  totalProfileFieldCount: number
  structuredTables: StructuredTableCount[]
  hasActiveRuleSet: boolean
}

const TABLE_LABELS: Record<string, string> = {
  brand_audiences: 'Аудитории',
  brand_pain_points: 'Боли аудитории',
  brand_products: 'Продукты',
  brand_claims: 'Утверждения',
  brand_terms: 'Термины',
  brand_content_pillars: 'Контент-столпы',
}

export default function BrandOsCoverageCard({ brandId }: { brandId: string }) {
  const [coverage, setCoverage] = useState<BrandCoverage | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!brandId) {
      setCoverage(null)
      setLoading(true)
      return
    }
    const controller = new AbortController()
    setLoading(true)
    fetch(`/api/brands/os-coverage?brand_id=${encodeURIComponent(brandId)}`, { cache: 'no-store', signal: controller.signal })
      .then((r) => r.json())
      .then((data: { brands?: BrandCoverage[] }) => {
        setCoverage(data.brands?.[0] ?? null)
      })
      .catch(() => setCoverage(null))
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })
    return () => controller.abort()
  }, [brandId])

  if (loading || !coverage) return null

  const emptyTables = coverage.structuredTables.filter((t) => t.count === 0)
  const hasGaps = coverage.emptyProfileFields.length > 0 || emptyTables.length > 0 || !coverage.hasActiveRuleSet

  if (!hasGaps) return null

  return (
    <div
      className="rounded-lg border p-3 text-sm"
      style={{ borderColor: 'var(--aug-danger-fg)', background: 'var(--aug-danger-bg)', color: 'var(--aug-danger-fg)' }}
    >
      <p className="font-semibold">
        Заполнено {coverage.filledProfileFieldCount} из {coverage.totalProfileFieldCount} текстовых полей профиля
      </p>
      {coverage.emptyProfileFields.length > 0 ? (
        <p className="mt-1 text-xs">Пустые поля: {coverage.emptyProfileFields.join(', ')}</p>
      ) : null}
      {emptyTables.length > 0 ? (
        <p className="mt-1 text-xs">
          Нет данных: {emptyTables.map((t) => TABLE_LABELS[t.table] ?? t.table).join(', ')}
        </p>
      ) : null}
      {!coverage.hasActiveRuleSet ? (
        <p className="mt-1 text-xs">Нет активного набора правил — генерация не применяет compliance-ограничения для этого бренда.</p>
      ) : null}
    </div>
  )
}
