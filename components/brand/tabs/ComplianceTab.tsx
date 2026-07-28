'use client'

import { useState, useEffect } from 'react'

interface QaFinding {
  id: string
  severity: 'critical' | 'high' | 'medium' | 'low'
  category: string
  description: string
  status: 'open' | 'in_review' | 'resolved' | 'waived'
  createdAt: string
}

export default function ComplianceTab({ brandId }: { brandId: string }) {
  const [findings, setFindings] = useState<QaFinding[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'open' | 'critical'>('all')

  useEffect(() => {
    if (!brandId) { setLoading(false); return }
    fetchFindings()
  }, [brandId])

  async function fetchFindings() {
    try {
      const res = await fetch(`/api/brands/${brandId}/qa-findings`)
      if (res.ok) setFindings((await res.json()).findings || [])
    } catch (err) { console.error(err) }
    finally { setLoading(false) }
  }

  const filtered = filter === 'all' ? findings :
    filter === 'open' ? findings.filter(f => f.status === 'open') :
    findings.filter(f => f.severity === 'critical')

  const stats = {
    total: findings.length,
    open: findings.filter(f => f.status === 'open').length,
    critical: findings.filter(f => f.severity === 'critical').length,
  }

  if (!brandId) return <div className="text-center py-12 text-gray-500">Selecione uma marca</div>
  if (loading) return <div className="text-center py-12">Carregando...</div>

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm text-gray-500">Total de Achados</div>
          <div className="text-2xl font-bold">{stats.total}</div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm text-gray-500">Abertos</div>
          <div className="text-2xl font-bold text-yellow-600">{stats.open}</div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm text-gray-500">Críticos</div>
          <div className="text-2xl font-bold text-red-600">{stats.critical}</div>
        </div>
      </div>

      <div className="flex space-x-2">
        {(['all', 'open', 'critical'] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)} className={`px-4 py-2 rounded-lg text-sm font-medium ${filter === f ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700'}`}>
            {f === 'all' ? 'Todos' : f === 'open' ? 'Abertos' : 'Críticos'}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {filtered.map(finding => (
          <div key={finding.id} className={`bg-white rounded-lg shadow p-4 border-l-4 ${
            finding.severity === 'critical' ? 'border-red-500' :
            finding.severity === 'high' ? 'border-orange-500' :
            finding.severity === 'medium' ? 'border-yellow-500' : 'border-blue-500'
          }`}>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center space-x-2">
                <span className={`px-2 py-1 rounded text-xs ${
                  finding.severity === 'critical' ? 'bg-red-100 text-red-800' :
                  finding.severity === 'high' ? 'bg-orange-100 text-orange-800' :
                  finding.severity === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                  'bg-blue-100 text-blue-800'
                }`}>{finding.severity}</span>
                <span className="text-sm text-gray-500">{finding.category}</span>
              </div>
              <span className={`px-2 py-1 rounded text-xs ${
                finding.status === 'open' ? 'bg-red-100 text-red-800' :
                finding.status === 'resolved' ? 'bg-green-100 text-green-800' :
                'bg-yellow-100 text-yellow-800'
              }`}>{finding.status}</span>
            </div>
            <p className="text-gray-700">{finding.description}</p>
            <p className="text-xs text-gray-400 mt-2">{new Date(finding.createdAt).toLocaleDateString('pt-BR')}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
