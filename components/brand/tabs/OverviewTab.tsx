'use client'

import { useState, useEffect, useCallback } from 'react'
import { fetchJson } from '@/lib/api-client'

interface BrandOverview {
  id: string
  brandName: string
  positioning: string
  voiceDescription: string
  targetAudience: string
  competitors: string
  isActive: boolean
  isDefault: boolean
  regionName: string
  locale: string
  ruleSetVersion: string
  ruleSetStatus: string
  totalRules: number
  approvedRules: number
  pendingRules: number
}

export default function OverviewTab({ brandId }: { brandId: string }) {
  const [overview, setOverview] = useState<BrandOverview | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchOverview = useCallback(async () => {
    const data = await fetchJson<{ overview?: BrandOverview }>(`/api/brands/${brandId}/overview`)
    if (data) setOverview(data.overview ?? null)
    setLoading(false)
  }, [brandId])

  useEffect(() => {
    if (!brandId) return
    // Confirmed false positive for "call a memoized async fetcher from an
    // effect"; see https://github.com/facebook/react/issues/34743
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchOverview()
  }, [brandId, fetchOverview])

  if (!brandId) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Выберите бренд, чтобы увидеть данные</p>
      </div>
    )
  }

  if (loading) {
    return <div className="text-center py-12">Загрузка...</div>
  }

  if (!overview) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Для этого бренда пока нет данных</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Positioning Card */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Позиционирование бренда</h2>
        <div className="prose max-w-none">
          <p className="text-gray-700 text-lg leading-relaxed">{overview.positioning || '—'}</p>
        </div>
        <div className="mt-4 flex items-center space-x-4">
          <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm">
            {overview.regionName}
          </span>
          <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm">
            {overview.locale}
          </span>
          {overview.isDefault && (
            <span className="px-3 py-1 bg-purple-100 text-purple-800 rounded-full text-sm">
              По умолчанию
            </span>
          )}
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-sm text-gray-500 mb-1">Версия политики</div>
          <div className="text-2xl font-bold text-gray-900">{overview.ruleSetVersion}</div>
          <div className={`text-sm mt-1 ${overview.ruleSetStatus === 'active' ? 'text-green-600' : 'text-yellow-600'}`}>
            {overview.ruleSetStatus === 'active' ? 'Активна' : overview.ruleSetStatus === 'none' ? 'Нет активной версии' : 'Черновик'}
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-sm text-gray-500 mb-1">Всего правил</div>
          <div className="text-2xl font-bold text-gray-900">{overview.totalRules}</div>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-sm text-gray-500 mb-1">Утверждено</div>
          <div className="text-2xl font-bold text-green-600">{overview.approvedRules}</div>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-sm text-gray-500 mb-1">Ожидает проверки</div>
          <div className="text-2xl font-bold text-yellow-600">{overview.pendingRules}</div>
        </div>
      </div>

      {/* Voice & Audience */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-3">Голос бренда</h3>
          <p className="text-gray-700">{overview.voiceDescription || '—'}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-3">Целевая аудитория</h3>
          <p className="text-gray-700">{overview.targetAudience || '—'}</p>
        </div>
      </div>

      {/* Competitors */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-3">Конкуренты</h3>
        <div className="flex flex-wrap gap-2">
          {overview.competitors
            ? overview.competitors.split(',').map((comp, i) => (
                <span key={i} className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-sm">
                  {comp.trim()}
                </span>
              ))
            : <span className="text-sm text-gray-500">—</span>}
        </div>
      </div>
    </div>
  )
}
