'use client'

import { useState, useEffect } from 'react'

interface RuleSet {
  id: string
  version: string
  status: 'draft' | 'active' | 'archived'
  createdAt: string
  activatedAt: string | null
  totalRules: number
  createdBy: string
}

export default function VersionsTab({ brandId }: { brandId: string }) {
  const [ruleSets, setRuleSets] = useState<RuleSet[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!brandId) { setLoading(false); return }
    fetchRuleSets()
  }, [brandId])

  async function fetchRuleSets() {
    try {
      const res = await fetch(`/api/brands/${brandId}/rule-sets`)
      if (res.ok) setRuleSets((await res.json()).ruleSets || [])
    } catch (err) { console.error(err) }
    finally { setLoading(false) }
  }

  if (!brandId) return <div className="text-center py-12 text-gray-500">Selecione uma marca</div>
  if (loading) return <div className="text-center py-12">Carregando...</div>

  return (
    <div className="space-y-4">
      {ruleSets.map(rs => (
        <div key={rs.id} className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center space-x-3">
              <h3 className="text-lg font-semibold">Versão {rs.version}</h3>
              <span className={`px-2 py-1 rounded text-xs ${
                rs.status === 'active' ? 'bg-green-100 text-green-800' :
                rs.status === 'draft' ? 'bg-yellow-100 text-yellow-800' :
                'bg-gray-100 text-gray-600'
              }`}>{rs.status}</span>
            </div>
            <span className="text-sm text-gray-500">{rs.totalRules} regras</span>
          </div>
          <div className="grid grid-cols-2 gap-4 text-sm text-gray-600">
            <div>Criado: {new Date(rs.createdAt).toLocaleDateString('pt-BR')}</div>
            <div>Ativado: {rs.activatedAt ? new Date(rs.activatedAt).toLocaleDateString('pt-BR') : '—'}</div>
            <div>Por: {rs.createdBy}</div>
          </div>
        </div>
      ))}
    </div>
  )
}
