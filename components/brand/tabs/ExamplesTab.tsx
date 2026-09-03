'use client'

import { useState, useEffect, useCallback } from 'react'
import { fetchJson } from '@/lib/api-client'

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
    const data = await fetchJson<{ examples?: Example[] }>(`/api/brands/${brandId}/examples`)
    if (data) setExamples(data.examples ?? [])
    setLoading(false)
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

  if (!brandId) return <div className="text-center py-12" style={{ color: 'var(--aug-muted)' }}>Выберите бренд</div>
  if (loading) return <div className="text-center py-12" style={{ color: 'var(--aug-muted)' }}>Загрузка...</div>

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        <label className="aug-field">
          <select onChange={e => setFilter(f => ({ ...f, platform: e.target.value || undefined }))}>
            <option value="">Все платформы</option>
            {platforms.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        </label>
        <label className="aug-field">
          <select onChange={e => setFilter(f => ({ ...f, format: e.target.value || undefined }))}>
            <option value="">Все форматы</option>
            {formats.map(f => <option key={f} value={f}>{f}</option>)}
          </select>
        </label>
      </div>

      <div className="space-y-4">
        {filtered.map(ex => (
          <div key={ex.id} className="m3-card p-6">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center space-x-2">
                <span
                  className="px-2 py-1 rounded text-xs"
                  style={{ background: 'var(--aug-accent-bg)', color: 'var(--aug-accent-fg)' }}
                >
                  {ex.platform}
                </span>
                <span
                  className="px-2 py-1 rounded text-xs"
                  style={{ background: 'var(--aug-neutral-bg)', color: 'var(--aug-neutral-fg)' }}
                >
                  {ex.format}
                </span>
                <span
                  className="px-2 py-1 rounded text-xs"
                  style={{ background: 'var(--aug-accent-bg)', color: 'var(--aug-accent-fg)' }}
                >
                  {ex.pillarName}
                </span>
              </div>
              <span className="text-xs" style={{ color: 'var(--aug-muted)' }}>{new Date(ex.approvedAt).toLocaleDateString('ru-RU')}</span>
            </div>
            <div className="p-4 rounded-2xl" style={{ background: 'var(--aug-soft)' }}>
              <p className="whitespace-pre-wrap" style={{ color: 'var(--aug-ink)' }}>{ex.content}</p>
            </div>
            <div className="mt-2 text-xs" style={{ color: 'var(--aug-muted)' }}>
              Продукт: {ex.productExplicitness}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
