'use client'

import { useState, useEffect } from 'react'
import { t } from '@/lib/i18n/config'

interface SourceHealth {
  id: string
  name: string
  url: string
  connectorType: string
  active: boolean
  category: string
  country: string
  health: {
    status: string
    consecutiveFailures: number
    lastSuccess: string | null
    lastFailure: string | null
    successRate24h: number | null
    events24h: number
  }
  itemsCount: number
}

interface HealthSummary {
  total: number
  healthy: number
  unhealthy: number
  inactive: number
  activeRate: number
  healthRate: number
}

interface PipelineMetrics {
  generatedToday: number
  publishedToday: number
  failedToday: number
  pendingRequests: number
}

export default function AnalyticsPage() {
  const [sources, setSources] = useState<SourceHealth[]>([])
  const [summary, setSummary] = useState<HealthSummary | null>(null)
  const [pipeline, setPipeline] = useState<PipelineMetrics | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    fetchData()
  }, [])

  async function fetchData() {
    try {
      setLoading(true)
      
      const healthRes = await fetch('/api/sources/health')
      if (!healthRes.ok) throw new Error('Failed to fetch source health')
      const healthData = await healthRes.json()
      setSources(healthData.sources || [])
      setSummary(healthData.summary || null)

      const pipelineRes = await fetch('/api/analytics/pipeline')
      if (pipelineRes.ok) {
        const pipelineData = await pipelineRes.json()
        setPipeline(pipelineData.metrics || null)
      }
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  function getStatusColor(status: string): string {
    switch (status) {
      case 'healthy': return 'bg-green-500'
      case 'degraded': return 'bg-yellow-500'
      case 'unhealthy': return 'bg-red-500'
      default: return 'bg-gray-400'
    }
  }

  function getStatusLabel(status: string): string {
    switch (status) {
      case 'healthy': return 'Saudável'
      case 'degraded': return 'Degradado'
      case 'unhealthy': return 'Crítico'
      default: return 'Desconhecido'
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-lg text-gray-600">Carregando analytics...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-lg text-red-600">Erro: {error}</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Analytics</h1>
        <p className="text-gray-600 mb-8">Métricas de ingestão e pipeline de conteúdo</p>

        {summary && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <div className="bg-white rounded-lg shadow p-6">
              <div className="text-sm text-gray-500 mb-1">Total de Fontes</div>
              <div className="text-3xl font-bold text-gray-900">{summary.total}</div>
            </div>
            <div className="bg-white rounded-lg shadow p-6">
              <div className="text-sm text-gray-500 mb-1">Fontes Saudáveis</div>
              <div className="text-3xl font-bold text-green-600">{summary.healthy}</div>
              <div className="text-sm text-gray-400">{summary.healthRate}% do total</div>
            </div>
            <div className="bg-white rounded-lg shadow p-6">
              <div className="text-sm text-gray-500 mb-1">Fontes Críticas</div>
              <div className="text-3xl font-bold text-red-600">{summary.unhealthy}</div>
            </div>
            <div className="bg-white rounded-lg shadow p-6">
              <div className="text-sm text-gray-500 mb-1">Taxa de Atividade</div>
              <div className="text-3xl font-bold text-blue-600">{summary.activeRate}%</div>
            </div>
          </div>
        )}

        {pipeline && (
          <div className="bg-white rounded-lg shadow mb-8">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">Pipeline de Conteúdo (24h)</h2>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-6">
              <div>
                <div className="text-sm text-gray-500 mb-1">Gerados</div>
                <div className="text-2xl font-bold text-blue-600">{pipeline.generatedToday}</div>
              </div>
              <div>
                <div className="text-sm text-gray-500 mb-1">Publicados</div>
                <div className="text-2xl font-bold text-green-600">{pipeline.publishedToday}</div>
              </div>
              <div>
                <div className="text-sm text-gray-500 mb-1">Falhas</div>
                <div className="text-2xl font-bold text-red-600">{pipeline.failedToday}</div>
              </div>
              <div>
                <div className="text-sm text-gray-500 mb-1">Pendentes</div>
                <div className="text-2xl font-bold text-yellow-600">{pipeline.pendingRequests}</div>
              </div>
            </div>
          </div>
        )}

        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
            <h2 className="text-lg font-semibold text-gray-900">Saúde das Fontes</h2>
            <button
              onClick={fetchData}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              {t('action.refresh')}
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Fonte</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Sucesso 24h</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Falhas Consecutivas</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Itens</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Último Sucesso</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {sources.map((source) => (
                  <tr key={source.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div className="text-sm font-medium text-gray-900">{source.name}</div>
                      <div className="text-sm text-gray-500">{source.connectorType}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center">
                        <div className={`w-2 h-2 rounded-full mr-2 ${getStatusColor(source.health.status)}`} />
                        <span className="text-sm text-gray-700">{getStatusLabel(source.health.status)}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-900">
                        {source.health.successRate24h !== null ? `${source.health.successRate24h}%` : 'N/A'}
                      </div>
                      <div className="text-sm text-gray-500">{source.health.events24h} eventos</div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`text-sm font-medium ${source.health.consecutiveFailures > 2 ? 'text-red-600' : 'text-gray-900'}`}>
                        {source.health.consecutiveFailures}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">{source.itemsCount}</td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {source.health.lastSuccess 
                        ? new Date(source.health.lastSuccess).toLocaleDateString('pt-BR')
                        : 'Nunca'
                      }
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
