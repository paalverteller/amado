'use client'

import { useState } from 'react'
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
  icon: string
}

const TABS: Tab[] = [
  { id: 'overview', label: 'Visão Geral', icon: '🏠' },
  { id: 'audience-pains', label: 'Público & Dores', icon: '👥' },
  { id: 'products-claims', label: 'Produtos & Claims', icon: '📦' },
  { id: 'voice-vocabulary', label: 'Voz & Vocabulário', icon: '🎙️' },
  { id: 'content-pillars', label: 'Pilares de Conteúdo', icon: '🏛️' },
  { id: 'platform-playbooks', label: 'Playbooks de Plataforma', icon: '📱' },
  { id: 'examples', label: 'Exemplos', icon: '✨' },
  { id: 'compliance', label: 'Compliance', icon: '🛡️' },
  { id: 'versions', label: 'Versões', icon: '📋' },
  { id: 'guideline-import', label: 'Importar Guidelines', icon: '📥' },
]

export default function BrandBrainPage() {
  const [activeTab, setActiveTab] = useState<TabId>('overview')
  const [brandId, setBrandId] = useState<string>('')

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
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Brand Brain</h1>
              <p className="text-gray-600 mt-1">Sistema operacional da marca Bitrix24 Brasil</p>
            </div>
            <div className="flex items-center space-x-4">
              <select
                value={brandId}
                onChange={(e) => setBrandId(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">Selecionar marca...</option>
                <option value="bitrix24-brasil">Bitrix24 Brasil</option>
              </select>
              <div className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm font-medium">
                v1.0-draft
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4">
          <nav className="flex space-x-1 overflow-x-auto" aria-label="Tabs">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`
                  px-4 py-3 text-sm font-medium border-b-2 whitespace-nowrap transition-colors
                  ${activeTab === tab.id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }
                `}
              >
                <span className="mr-2">{tab.icon}</span>
                {tab.label}
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 py-8">
        {renderTab()}
      </div>
    </div>
  )
}
