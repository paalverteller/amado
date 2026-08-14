'use client'

import { useEffect, useState } from 'react'
import Layout from '@/components/Layout'
import { t } from '@/lib/i18n/config'
import OverviewTab from '@/components/brand/tabs/OverviewTab'
import AudiencePainsTab from '@/components/brand/tabs/AudiencePainsTab'
import ProductsClaimsTab from '@/components/brand/tabs/ProductsClaimsTab'
import VoiceVocabularyTab from '@/components/brand/tabs/VoiceVocabularyTab'
import ContentPillarsTab from '@/components/brand/tabs/ContentPillarsTab'
import PlatformPlaybooksTab from '@/components/brand/tabs/PlatformPlaybooksTab'
import ExamplesTab from '@/components/brand/tabs/ExamplesTab'
import ComplianceTab from '@/components/brand/tabs/ComplianceTab'
import VersionsTab from '@/components/brand/tabs/VersionsTab'
import GuidelineImportTab from '@/components/brand/tabs/GuidelineImportTab'

type TabId =
  | 'overview'
  | 'audience-pains'
  | 'products-claims'
  | 'voice-vocabulary'
  | 'content-pillars'
  | 'platform-playbooks'
  | 'examples'
  | 'compliance'
  | 'versions'
  | 'guideline-import'

interface Tab {
  id: TabId
  label: string
}

interface BrandListItem {
  id: string
  brand_name: string
  is_default: boolean
  is_active: boolean
}

// Russian labels for the tabs as they exist today. NOT yet remapped to the
// plan's exact 9 named sections (Основа бренда/Аудитория/Продукт/Тон и
// стиль/Разрешённые утверждения/Запрещённые формулировки/Правила площадок/
// Источники бренда/История изменений) — two of those names are ambiguous
// against the current 10-tab structure (claims vs. vocabulary both touch
// "forbidden wording") and this tab set also has 3 tabs (content-pillars,
// examples, compliance) with no obvious home in that list. Restructuring
// needs an explicit decision, not a guess — see docs/AMADO_ROADMAP.md.
const TABS: Tab[] = [
  { id: 'overview', label: 'Обзор' },
  { id: 'audience-pains', label: 'Аудитория и боли' },
  { id: 'products-claims', label: 'Продукты и утверждения' },
  { id: 'voice-vocabulary', label: 'Голос и словарь' },
  { id: 'content-pillars', label: 'Контент-пилары' },
  { id: 'platform-playbooks', label: 'Правила площадок' },
  { id: 'examples', label: 'Примеры' },
  { id: 'compliance', label: 'Проверка' },
  { id: 'versions', label: 'История изменений' },
  { id: 'guideline-import', label: 'Импорт гайдлайнов' },
]

export default function BrandBrainPage() {
  const [activeTab, setActiveTab] = useState<TabId>('overview')
  const [brands, setBrands] = useState<BrandListItem[]>([])
  const [brandId, setBrandId] = useState<string>('')
  const [brandsLoading, setBrandsLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    fetch('/api/brands')
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error('request failed'))))
      .then((data: { items?: BrandListItem[] }) => {
        if (cancelled) return
        const items = data.items ?? []
        setBrands(items)
        const preferred = items.find((b) => b.is_default) ?? items[0]
        if (preferred) setBrandId(preferred.id)
      })
      .catch(() => {
        if (!cancelled) setBrands([])
      })
      .finally(() => {
        if (!cancelled) setBrandsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const renderTab = () => {
    switch (activeTab) {
      case 'overview':
        return <OverviewTab brandId={brandId} />
      case 'audience-pains':
        return <AudiencePainsTab brandId={brandId} />
      case 'products-claims':
        return <ProductsClaimsTab brandId={brandId} />
      case 'voice-vocabulary':
        return <VoiceVocabularyTab brandId={brandId} />
      case 'content-pillars':
        return <ContentPillarsTab brandId={brandId} />
      case 'platform-playbooks':
        return <PlatformPlaybooksTab brandId={brandId} />
      case 'examples':
        return <ExamplesTab brandId={brandId} />
      case 'compliance':
        return <ComplianceTab brandId={brandId} />
      case 'versions':
        return <VersionsTab brandId={brandId} />
      case 'guideline-import':
        return <GuidelineImportTab brandId={brandId} />
      default:
        return <OverviewTab brandId={brandId} />
    }
  }

  return (
    <Layout>
      <div className="flex flex-col gap-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold" style={{ color: 'var(--v2-color-text-primary)' }}>{t('nav.brand')}</h1>
            <p className="text-sm mt-1" style={{ color: 'var(--v2-color-text-secondary)' }}>
              Операционная система бренда
            </p>
          </div>
          <select
            value={brandId}
            onChange={(e) => setBrandId(e.target.value)}
            className="rounded border px-3 py-2 text-sm"
            style={{ borderColor: 'var(--v2-color-border-strong)' }}
          >
            {brandsLoading && <option value="">Загрузка...</option>}
            {!brandsLoading && brands.length === 0 && <option value="">Бренды не найдены</option>}
            {brands.map((b) => (
              <option key={b.id} value={b.id}>
                {b.brand_name}{b.is_default ? ' · по умолчанию' : ''}
              </option>
            ))}
          </select>
        </div>

        <nav className="flex gap-1 overflow-x-auto border-b" style={{ borderColor: 'var(--v2-color-border-default)' }}>
          {TABS.map((tabItem) => (
            <button
              key={tabItem.id}
              type="button"
              onClick={() => setActiveTab(tabItem.id)}
              className="px-4 py-3 text-sm font-medium border-b-2 whitespace-nowrap transition-colors"
              style={{
                borderColor: activeTab === tabItem.id ? 'var(--v2-color-brand-primary)' : 'transparent',
                color: activeTab === tabItem.id ? 'var(--v2-color-brand-primary)' : 'var(--v2-color-text-secondary)',
                background: 'transparent',
              }}
            >
              {tabItem.label}
            </button>
          ))}
        </nav>

        <div>{renderTab()}</div>
      </div>
    </Layout>
  )
}
