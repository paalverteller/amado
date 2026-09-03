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

const STATUS_BADGE_STYLE: Record<ImportRun['status'], { background: string; color: string }> = {
  pending: { background: 'var(--aug-accent-bg)', color: 'var(--aug-accent-fg)' },
  extracting: { background: 'var(--aug-accent-bg)', color: 'var(--aug-accent-fg)' },
  review: { background: 'var(--aug-warning-bg)', color: 'var(--aug-warning-fg)' },
  published: { background: 'var(--aug-success-bg)', color: 'var(--aug-success-fg)' },
  failed: { background: 'var(--aug-danger-bg)', color: 'var(--aug-danger-fg)' },
}

const STATUS_LABEL: Record<ImportRun['status'], string> = {
  pending: 'В очереди',
  extracting: 'Извлечение',
  review: 'На проверке',
  published: 'Опубликовано',
  failed: 'Ошибка',
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

  if (!brandId) return <div className="text-center py-12" style={{ color: 'var(--aug-muted)' }}>Выберите бренд</div>

  return (
    <div className="space-y-6">
      {/* Import Form */}
      <div className="m3-card p-6">
        <h3 className="text-lg font-semibold mb-4" style={{ color: 'var(--aug-ink)' }}>Импорт правил</h3>
        <div className="space-y-4">
          <label className="aug-field">
            <span>Тип источника</span>
            <select value={sourceType} onChange={e => setSourceType(e.target.value)}>
              <option value="brand_book">Брендбук</option>
              <option value="style_guide">Гайд по стилю</option>
              <option value="legal_review">Юридическая проверка</option>
              <option value="competitor_analysis">Анализ конкурентов</option>
              <option value="manual">Ручной ввод</option>
            </select>
          </label>
          <label className="aug-field">
            <span>URL (необязательно)</span>
            <input type="url" value={sourceUrl} onChange={e => setSourceUrl(e.target.value)} placeholder="https://..." />
          </label>
          <label className="aug-field">
            <span>Текст правил</span>
            <textarea value={sourceText} onChange={e => setSourceText(e.target.value)} rows={6} placeholder="Вставьте текст правил…" />
          </label>
          {error && <p className="text-sm" style={{ color: 'var(--aug-danger-fg)' }}>{error}</p>}
          <button onClick={startImport} disabled={loading} className="aug-button aug-button--primary">
            {loading ? 'Обработка...' : 'Начать импорт'}
          </button>
        </div>
      </div>

      {/* Active Import Status */}
      {activeImport && (
        <div className="m3-card p-6">
          <h3 className="text-lg font-semibold mb-4" style={{ color: 'var(--aug-ink)' }}>Статус импорта</h3>
          <div className="flex items-center space-x-4 mb-4">
            <span
              className="px-3 py-1 rounded-full text-sm"
              style={STATUS_BADGE_STYLE[activeImport.status] ?? STATUS_BADGE_STYLE.pending}
            >
              {STATUS_LABEL[activeImport.status] ?? activeImport.status}
            </span>
            <span className="text-sm" style={{ color: 'var(--aug-muted)' }}>{new Date(activeImport.createdAt).toLocaleString('ru-RU')}</span>
          </div>
          <div className="grid grid-cols-4 gap-4 mb-4">
            <div className="text-center p-3 rounded-2xl" style={{ background: 'var(--aug-soft)' }}>
              <div className="text-2xl font-bold" style={{ color: 'var(--aug-ink)' }}>{activeImport.totalCandidates}</div>
              <div className="text-xs" style={{ color: 'var(--aug-muted)' }}>Кандидатов</div>
            </div>
            <div className="text-center p-3 rounded-2xl" style={{ background: 'var(--aug-success-bg)' }}>
              <div className="text-2xl font-bold" style={{ color: 'var(--aug-success-fg)' }}>{activeImport.approvedCount}</div>
              <div className="text-xs" style={{ color: 'var(--aug-muted)' }}>Одобрено</div>
            </div>
            <div className="text-center p-3 rounded-2xl" style={{ background: 'var(--aug-danger-bg)' }}>
              <div className="text-2xl font-bold" style={{ color: 'var(--aug-danger-fg)' }}>{activeImport.rejectedCount}</div>
              <div className="text-xs" style={{ color: 'var(--aug-muted)' }}>Отклонено</div>
            </div>
            <div className="text-center p-3 rounded-2xl" style={{ background: 'var(--aug-warning-bg)' }}>
              <div className="text-2xl font-bold" style={{ color: 'var(--aug-warning-fg)' }}>{activeImport.conflictCount}</div>
              <div className="text-xs" style={{ color: 'var(--aug-muted)' }}>Конфликтов</div>
            </div>
          </div>
          {activeImport.status === 'review' && (
            <button onClick={publishApproved} disabled={loading} className="aug-button aug-button--primary">
              {loading ? 'Публикация...' : 'Опубликовать одобренные правила'}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
