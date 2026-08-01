'use client'

import { useState, useEffect, useCallback } from 'react'

interface Playbook {
  id: string
  platform: string
  format: string
  tone: string
  structure: string
  ctaStyle: string
  maxLength: number
  hashtagStrategy: string
  emojiPolicy: string
  linkPolicy: string
  active: boolean
}

export default function PlatformPlaybooksTab({ brandId }: { brandId: string }) {
  const [playbooks, setPlaybooks] = useState<Playbook[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedPlatform, setSelectedPlatform] = useState<string>('all')

  const fetchPlaybooks = useCallback(async () => {
    try {
      const res = await fetch(`/api/brands/${brandId}/playbooks`)
      if (res.ok) setPlaybooks((await res.json()).playbooks || [])
    } catch (err) { console.error(err) }
    finally { setLoading(false) }
  }, [brandId])

  useEffect(() => {
    if (!brandId) return
    // Confirmed false positive for "call a memoized async fetcher from an
    // effect"; see https://github.com/facebook/react/issues/34743
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchPlaybooks()
  }, [brandId, fetchPlaybooks])

  const platforms = ['all', ...Array.from(new Set(playbooks.map(p => p.platform)))]
  const filtered = selectedPlatform === 'all' ? playbooks : playbooks.filter(p => p.platform === selectedPlatform)

  if (!brandId) return <div className="text-center py-12 text-gray-500">Selecione uma marca</div>
  if (loading) return <div className="text-center py-12">Carregando...</div>

  return (
    <div className="space-y-6">
      <div className="flex space-x-2">
        {platforms.map(p => (
          <button key={p} onClick={() => setSelectedPlatform(p)} className={`px-4 py-2 rounded-lg text-sm font-medium ${selectedPlatform === p ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>
            {p === 'all' ? 'Todas' : p}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {filtered.map(pb => (
          <div key={pb.id} className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold">{pb.platform}</h3>
                <p className="text-sm text-gray-500">{pb.format}</p>
              </div>
              <span className={`px-2 py-1 rounded text-xs ${pb.active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>
                {pb.active ? 'Ativo' : 'Inativo'}
              </span>
            </div>

            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-500">Tom:</span>
                  <p className="font-medium">{pb.tone}</p>
                </div>
                <div>
                  <span className="text-gray-500">CTA:</span>
                  <p className="font-medium">{pb.ctaStyle}</p>
                </div>
                <div>
                  <span className="text-gray-500">Máx. caracteres:</span>
                  <p className="font-medium">{pb.maxLength}</p>
                </div>
                <div>
                  <span className="text-gray-500">Emojis:</span>
                  <p className="font-medium">{pb.emojiPolicy}</p>
                </div>
              </div>

              <div>
                <span className="text-gray-500 text-sm">Estrutura:</span>
                <p className="text-sm text-gray-700 mt-1">{pb.structure}</p>
              </div>

              <div>
                <span className="text-gray-500 text-sm">Hashtags:</span>
                <p className="text-sm text-gray-700 mt-1">{pb.hashtagStrategy}</p>
              </div>

              <div>
                <span className="text-gray-500 text-sm">Links:</span>
                <p className="text-sm text-gray-700 mt-1">{pb.linkPolicy}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
