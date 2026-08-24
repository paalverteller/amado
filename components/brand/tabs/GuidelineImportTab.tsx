'use client'

import { useState } from 'react'
import { getErrorMessage } from '@/lib/api/error-message'

interface ImportRun {
  id: string
  status: 'pending' | 'extracting' | 'review' | 'published' | 'failed'
  sourceType: string
  totalCandidates: number
  approvedCount: number
  rejectedCount: number
  conflictCount: number
  createdAt: string
}

export default function GuidelineImportTab({ brandId }: { brandId: string }) {
  const [sourceType, setSourceType] = useState('brand_book')
  const [sourceUrl, setSourceUrl] = useState('')
  const [sourceText, setSourceText] = useState('')
  const [activeImport, setActiveImport] = useState<ImportRun | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function startImport() {
    if (!sourceUrl && !sourceText) {
      setError('Укажите URL или текст правил')
      return
    }
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`/api/brands/${brandId}/guidelines/import`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          sourceType, 
          sourceUrl: sourceUrl || undefined, 
          sourceText: sourceText || undefined 
        }),
      })
      if (!res.ok) throw new Error(await res.text())
      const data = await res.json()
      setActiveImport({
        ...data.importRun,
        totalCandidates: data.importRun.stats?.total || 0,
        approvedCount: 0,
        rejectedCount: 0,
        conflictCount: data.importRun.stats?.conflicts || 0,
      })
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  async function publishApproved() {
    if (!activeImport) return
    setLoading(true)
    try {
      const res = await fetch(`/api/brands/${brandId}/guidelines/import/${activeImport.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ publish: true }),
      })
      if (!res.ok) throw new Error(await res.text())
      const data = await res.json()
      if (data.success) {
        setActiveImport(prev => prev ? { ...prev, status: 'published' } : null)
      }
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  if (!brandId) return <div className="text-center py-12 text-gray-500">Выберите бренд</div>

  return (
    <div className="space-y-6">
      {/* Import Form */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold mb-4">Импорт правил</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Тип источника</label>
            <select value={sourceType} onChange={e => setSourceType(e.target.value)} className="w-full px-3 py-2 border rounded-lg">
              <option value="brand_book">Брендбук</option>
              <option value="style_guide">Гайд по стилю</option>
              <option value="legal_review">Юридическая проверка</option>
              <option value="competitor_analysis">Анализ конкурентов</option>
              <option value="manual">Ручной ввод</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">URL (необязательно)</label>
            <input type="url" value={sourceUrl} onChange={e => setSourceUrl(e.target.value)} className="w-full px-3 py-2 border rounded-lg" placeholder="https://..." />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Текст правил</label>
            <textarea value={sourceText} onChange={e => setSourceText(e.target.value)} rows={6} className="w-full px-3 py-2 border rounded-lg" placeholder="Вставьте текст правил…" />
          </div>
          {error && <p className="text-red-600 text-sm">{error}</p>}
          <button onClick={startImport} disabled={loading} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
            {loading ? 'Обработка...' : 'Начать импорт'}
          </button>
        </div>
      </div>

      {/* Active Import Status */}
      {activeImport && (
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold mb-4">Статус импорта</h3>
          <div className="flex items-center space-x-4 mb-4">
            <span className={`px-3 py-1 rounded-full text-sm ${
              activeImport.status === 'published' ? 'bg-green-100 text-green-800' :
              activeImport.status === 'failed' ? 'bg-red-100 text-red-800' :
              activeImport.status === 'review' ? 'bg-yellow-100 text-yellow-800' :
              'bg-blue-100 text-blue-800'
            }`}>{
              activeImport.status === 'published' ? 'Опубликовано' :
              activeImport.status === 'failed' ? 'Ошибка' :
              activeImport.status === 'review' ? 'На проверке' :
              activeImport.status === 'extracting' ? 'Извлечение' : 'В очереди'
            }</span>
            <span className="text-sm text-gray-500">{new Date(activeImport.createdAt).toLocaleString('ru-RU')}</span>
          </div>
          <div className="grid grid-cols-4 gap-4 mb-4">
            <div className="text-center p-3 bg-gray-50 rounded">
              <div className="text-2xl font-bold">{activeImport.totalCandidates}</div>
              <div className="text-xs text-gray-500">Кандидатов</div>
            </div>
            <div className="text-center p-3 bg-green-50 rounded">
              <div className="text-2xl font-bold text-green-600">{activeImport.approvedCount}</div>
              <div className="text-xs text-gray-500">Одобрено</div>
            </div>
            <div className="text-center p-3 bg-red-50 rounded">
              <div className="text-2xl font-bold text-red-600">{activeImport.rejectedCount}</div>
              <div className="text-xs text-gray-500">Отклонено</div>
            </div>
            <div className="text-center p-3 bg-yellow-50 rounded">
              <div className="text-2xl font-bold text-yellow-600">{activeImport.conflictCount}</div>
              <div className="text-xs text-gray-500">Конфликтов</div>
            </div>
          </div>
          {activeImport.status === 'review' && (
            <button onClick={publishApproved} disabled={loading} className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50">
              {loading ? 'Публикация...' : 'Опубликовать одобренные правила'}
            </button>
          )}
        </div>
      )}
    </div>
  )
}