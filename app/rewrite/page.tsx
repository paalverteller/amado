'use client'

import { useState } from 'react'
import Layout from '@/components/Layout'
import { useMarket } from '@/lib/market-context'

const INTENSITIES = [
  { id: 'light',  label: 'Лёгкая',   desc: 'Минимальные изменения' },
  { id: 'medium', label: 'Средняя',  desc: 'Заметная переработка' },
  { id: 'deep',   label: 'Глубокая', desc: 'Полная переработка' },
] as const

type Intensity = typeof INTENSITIES[number]['id']

export default function RewritePage() {
  const { regions, marketCode } = useMarket()
  const currentRegionId = regions.find((region) => region.code === marketCode)?.id ?? null
  const [sourceText, setSourceText]   = useState('')
  const [intensity, setIntensity]     = useState<Intensity>('deep')
  const [rewritten, setRewritten]     = useState('')
  const [uniqueness, setUniqueness]   = useState<number | null>(null)
  const [loading, setLoading]         = useState(false)
  const [error, setError]             = useState('')
  const [copied, setCopied]           = useState(false)

  async function handleRewrite() {
    setError('')
    setRewritten('')
    setUniqueness(null)

    if (sourceText.trim().length < 200) {
      setError('Текст слишком короткий: минимум 200 знаков')
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/rewrite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sourceText: sourceText.trim(), intensity, regionId: currentRegionId || undefined }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Не удалось переписать текст')

      setRewritten(data.rewritten)
      setUniqueness(data.uniqueness)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Неизвестная ошибка')
    } finally {
      setLoading(false)
    }
  }

  function handleCopy() {
    if (!rewritten) return
    navigator.clipboard.writeText(rewritten)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  function uniquenessColor(score: number): string {
    if (score >= 85) return '#276131'
    if (score >= 70) return '#7B5813'
    return '#A43F3F'
  }

  return (
    <Layout>
      <div style={{ maxWidth: 760, margin: '0 auto' }}>
        <div className="mb-6">
          <h1
            className="text-2xl font-bold m-0"
            style={{ fontFamily: 'var(--font-display)', color: 'var(--color-on-background)' }}
          >
            Rewrite
          </h1>
          <p className="text-sm m-0 mt-1" style={{ color: 'var(--color-on-surface-variant)' }}>
            Вставьте текст и получите естественно переписанную версию для выбранного рынка
          </p>
        </div>

        {/* Intensity selector */}
        <div className="m3-card p-4 mb-4">
          <label className="text-xs font-semibold uppercase tracking-wide mb-3 block"
                 style={{ color: 'var(--color-on-surface-variant)' }}>
            Степень переработки
          </label>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            {INTENSITIES.map(({ id, label, desc }) => (
              <button
                key={id}
                type="button"
                onClick={() => setIntensity(id)}
                style={{
                  flex: 1,
                  padding: '0.75rem 0.5rem',
                  borderRadius: 12,
                  border: intensity === id ? '1.5px solid #6E5CF6' : '1.5px solid rgba(110,92,246,0.15)',
                  background: intensity === id ? 'rgba(110,92,246,0.08)' : 'transparent',
                  cursor: 'pointer',
                  textAlign: 'center',
                  transition: 'all 180ms ease',
                }}
              >
                <div style={{
                  fontSize: 13, fontWeight: 700,
                  color: intensity === id ? 'var(--color-primary)' : 'var(--color-on-surface)',
                }}>
                  {label}
                </div>
                <div style={{ fontSize: 11, color: 'var(--color-on-surface-variant)', marginTop: 2 }}>
                  {desc}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Source text input */}
        <div className="m3-card p-4 mb-4">
          <label className="text-xs font-semibold uppercase tracking-wide mb-2 block"
                 style={{ color: 'var(--color-on-surface-variant)' }}>
            Исходный текст
          </label>
          <textarea
            value={sourceText}
            onChange={(e) => setSourceText(e.target.value)}
            placeholder="Вставьте исходный текст…"
            rows={10}
            className="m3-input-outlined"
            style={{ resize: 'vertical', fontFamily: 'var(--font-sans)', lineHeight: 1.6 }}
          />
          <div className="flex justify-between items-center mt-2">
            <span style={{ fontSize: 11, color: 'var(--color-on-surface-variant)' }}>
              {sourceText.length} знаков
            </span>
          </div>
        </div>

        {error && (
          <div className="p-4 rounded-xl text-sm mb-4 font-medium"
               style={{ background: 'var(--color-error-container)', color: 'var(--color-on-error-container)' }}>
            {error}
          </div>
        )}

        <button
          type="button"
          onClick={handleRewrite}
          disabled={loading || sourceText.trim().length < 200}
          className="m3-button-filled w-full h-12 text-base disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {loading ? 'Переписываю…' : 'Переписать'}
        </button>

        {/* Result */}
        {rewritten && (
          <div className="m3-card p-4 mt-6">
            <div className="flex justify-between items-center mb-3">
              <label className="text-xs font-semibold uppercase tracking-wide"
                     style={{ color: 'var(--color-on-surface-variant)' }}>
                Результат
              </label>
              {uniqueness !== null && (
                <span style={{
                  fontSize: 12, fontWeight: 700, padding: '4px 10px', borderRadius: 8,
                  background: `${uniquenessColor(uniqueness)}1A`,
                  color: uniquenessColor(uniqueness),
                }}>
                  Уникальность ~{uniqueness}%
                </span>
              )}
            </div>
            <div
              style={{
                whiteSpace: 'pre-wrap',
                lineHeight: 1.7,
                fontSize: 14.5,
                color: 'var(--color-on-surface)',
                maxHeight: 480,
                overflowY: 'auto',
                padding: '0.5rem',
              }}
            >
              {rewritten}
            </div>
            <button
              type="button"
              onClick={handleCopy}
              className="m3-button-tonal mt-3"
            >
              {copied ? 'Скопировано ✓' : 'Копировать текст'}
            </button>
          </div>
        )}
      </div>
    </Layout>
  )
}
