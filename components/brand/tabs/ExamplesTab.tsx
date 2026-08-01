'use client'

import { useState, useEffect, useCallback } from 'react'

interface Example {
  id: string
  platform: string
  format: string
  content: string
  pillarName: string
  productExplicitness: string
  approvedAt: string
}

export default function ExamplesTab({ brandId }: { brandId: string }) {
  const [examples, setExamples] = useState<Example[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<{ platform?: string; format?: string }>({})

  const fetchExamples = useCallback(async () => {
    try {
      const res = await fetch(`/api/brands/${brandId}/examples`)
      if (res.ok) setExamples((await res.json()).examples || [])
    } catch (err) { console.error(err) }
    finally { setLoading(false) }
  }, [brandId])

  useEffect(() => {
    if (!brandId) return
    // Confirmed false positive for "call a memoized async fetcher from an
    // effect"; see https://github.com/facebook/react/issues/34743
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchExamples()
  }, [brandId, fetchExamples])

  const platforms = Array.from(new Set(examples.map(e => e.platform)))
  const formats = Array.from(new Set(examples.map(e => e.format)))

  const filtered = examples.filter(e => {
    if (filter.platform && e.platform !== filter.platform) return false
    if (filter.format && e.format !== filter.format) return false
    return true
  })

  if (!brandId) return <div className="text-center py-12 text-gray-500">Selecione uma marca</div>
  if (loading) return <div className="text-center py-12">Carregando...</div>

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        <select onChange={e => setFilter(f => ({ ...f, platform: e.target.value || undefined }))} className="px-3 py-2 border rounded-lg text-sm">
          <option value="">Todas as plataformas</option>
          {platforms.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
        <select onChange={e => setFilter(f => ({ ...f, format: e.target.value || undefined }))} className="px-3 py-2 border rounded-lg text-sm">
          <option value="">Todos os formatos</option>
          {formats.map(f => <option key={f} value={f}>{f}</option>)}
        </select>
      </div>

      <div className="space-y-4">
        {filtered.map(ex => (
          <div key={ex.id} className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center space-x-2">
                <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs">{ex.platform}</span>
                <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs">{ex.format}</span>
                <span className="px-2 py-1 bg-purple-100 text-purple-800 rounded text-xs">{ex.pillarName}</span>
              </div>
              <span className="text-xs text-gray-400">{new Date(ex.approvedAt).toLocaleDateString('pt-BR')}</span>
            </div>
            <div className="p-4 bg-gray-50 rounded-lg">
              <p className="text-gray-800 whitespace-pre-wrap">{ex.content}</p>
            </div>
            <div className="mt-2 text-xs text-gray-500">
              Produto: {ex.productExplicitness}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
