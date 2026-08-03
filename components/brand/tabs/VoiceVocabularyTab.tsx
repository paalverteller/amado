'use client'

import { useState, useEffect, useCallback } from 'react'

interface Term {
  id: string
  term: string
  policy: 'preferred' | 'allowed' | 'discouraged' | 'forbidden'
  replacement: string
  notes: string
}

export default function VoiceVocabularyTab({ brandId }: { brandId: string }) {
  const [terms, setTerms] = useState<Term[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'forbidden' | 'preferred' | 'discouraged'>('all')

  const fetchTerms = useCallback(async () => {
    try {
      const res = await fetch(`/api/brands/${brandId}/terms`)
      if (res.ok) setTerms((await res.json()).terms || [])
    } catch (err) { console.error(err) }
    finally { setLoading(false) }
  }, [brandId])

  useEffect(() => {
    if (!brandId) return
    // Confirmed false positive for "call a memoized async fetcher from an
    // effect"; see https://github.com/facebook/react/issues/34743
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchTerms()
  }, [brandId, fetchTerms])

  const filtered = filter === 'all' ? terms : terms.filter(t => t.policy === filter)

  if (!brandId) return <div className="text-center py-12 text-gray-500">Selecione uma marca</div>
  if (loading) return <div className="text-center py-12">Carregando...</div>

  return (
    <div className="space-y-6">
      <div className="flex space-x-2">
        {(['all', 'forbidden', 'preferred', 'discouraged'] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)} className={`px-4 py-2 rounded-lg text-sm font-medium ${filter === f ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>
            {f === 'all' ? 'Todos' : f === 'forbidden' ? 'Proibidos' : f === 'preferred' ? 'Preferidos' : 'Desencorajados'}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map(term => (
          <div key={term.id} className={`bg-white rounded-lg shadow p-4 border-l-4 ${
            term.policy === 'forbidden' ? 'border-red-500' :
            term.policy === 'preferred' ? 'border-green-500' :
            term.policy === 'discouraged' ? 'border-yellow-500' : 'border-gray-300'
          }`}>
            <div className="flex items-center justify-between mb-2">
              <span className="font-semibold text-gray-900">{term.term}</span>
              <span className={`px-2 py-1 rounded text-xs ${
                term.policy === 'forbidden' ? 'bg-red-100 text-red-800' :
                term.policy === 'preferred' ? 'bg-green-100 text-green-800' :
                term.policy === 'discouraged' ? 'bg-yellow-100 text-yellow-800' :
                'bg-gray-100 text-gray-800'
              }`}>{term.policy}</span>
            </div>
            {term.replacement && <p className="text-sm text-blue-600">→ {term.replacement}</p>}
            {term.notes && <p className="text-sm text-gray-500 mt-1">{term.notes}</p>}
          </div>
        ))}
      </div>
    </div>
  )
}
