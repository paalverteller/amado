'use client'

import { useState, useEffect } from 'react'

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

  useEffect(() => {
    if (!brandId) {
      setLoading(false)
      return
    }
    fetchOverview()
  }, [brandId])

  async function fetchOverview() {
    try {
      const res = await fetch(`/api/brands/${brandId}/overview`)
      if (res.ok) {
        const data = await res.json()
        setOverview(data.overview)
      }
    } catch (err) {
      console.error('Failed to fetch overview:', err)
    } finally {
      setLoading(false)
    }
  }

  if (!brandId) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Selecione uma marca para visualizar os dados</p>
      </div>
    )
  }

  if (loading) {
    return <div className="text-center py-12">Carregando...</div>
  }

  if (!overview) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Nenhuma informação encontrada para esta marca</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Positioning Card */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Posicionamento da Marca</h2>
        <div className="prose max-w-none">
          <p className="text-gray-700 text-lg leading-relaxed">{overview.positioning}</p>
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
              Padrão
            </span>
          )}
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-sm text-gray-500 mb-1">Versão da Política</div>
          <div className="text-2xl font-bold text-gray-900">{overview.ruleSetVersion}</div>
          <div className={`text-sm mt-1 ${overview.ruleSetStatus === 'active' ? 'text-green-600' : 'text-yellow-600'}`}>
            {overview.ruleSetStatus === 'active' ? 'Ativa' : 'Rascunho'}
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-sm text-gray-500 mb-1">Total de Regras</div>
          <div className="text-2xl font-bold text-gray-900">{overview.totalRules}</div>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-sm text-gray-500 mb-1">Regras Aprovadas</div>
          <div className="text-2xl font-bold text-green-600">{overview.approvedRules}</div>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-sm text-gray-500 mb-1">Pendentes</div>
          <div className="text-2xl font-bold text-yellow-600">{overview.pendingRules}</div>
        </div>
      </div>

      {/* Voice & Audience */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-3">Voz da Marca</h3>
          <p className="text-gray-700">{overview.voiceDescription}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-3">Público-Alvo</h3>
          <p className="text-gray-700">{overview.targetAudience}</p>
        </div>
      </div>

      {/* Competitors */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-3">Concorrentes</h3>
        <div className="flex flex-wrap gap-2">
          {overview.competitors.split(',').map((comp, i) => (
            <span key={i} className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-sm">
              {comp.trim()}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}
