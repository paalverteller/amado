'use client'

import { useState, useEffect } from 'react'

interface Pillar {
  id: string
  name: string
  purpose: string
  defaultProductExplicitness: string
  riskLevel: string
  sortOrder: number
}

export default function ContentPillarsTab({ brandId }: { brandId: string }) {
  const [pillars, setPillars] = useState<Pillar[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!brandId) { setLoading(false); return }
    fetchPillars()
  }, [brandId])

  async function fetchPillars() {
    try {
      const res = await fetch(`/api/brands/${brandId}/pillars`)
      if (res.ok) setPillars((await res.json()).pillars || [])
    } catch (err) { console.error(err) }
    finally { setLoading(false) }
  }

  if (!brandId) return <div className="text-center py-12 text-gray-500">Selecione uma marca</div>
  if (loading) return <div className="text-center py-12">Carregando...</div>

  return (
    <div className="space-y-4">
      {pillars.sort((a, b) => a.sortOrder - b.sortOrder).map(pillar => (
        <div key={pillar.id} className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center space-x-3">
              <span className="w-8 h-8 bg-blue-100 text-blue-800 rounded-full flex items-center justify-center text-sm font-bold">
                {pillar.sortOrder}
              </span>
              <h3 className="text-lg font-semibold">{pillar.name}</h3>
            </div>
            <div className="flex space-x-2">
              <span className={`px-2 py-1 rounded text-xs ${
                pillar.riskLevel === 'high' ? 'bg-red-100 text-red-800' :
                pillar.riskLevel === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                'bg-green-100 text-green-800'
              }`}>{pillar.riskLevel}</span>
              <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs">{pillar.defaultProductExplicitness}</span>
            </div>
          </div>
          <p className="text-gray-600">{pillar.purpose}</p>
        </div>
      ))}
    </div>
  )
}
