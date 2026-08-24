'use client'

import { useEffect, useState } from 'react'
import Layout from '@/components/Layout'
import { toast } from '@/components/ui/AugustFeedback'
import type { BrandProfile } from '@/lib/domain/brand-profile'
import { useMarket } from '@/lib/market-context'

export default function SeoArticlePage() {
  const { regions, marketCode } = useMarket()
  const currentRegionId = regions.find((region) => region.code === marketCode)?.id ?? null
  const [topic, setTopic] = useState('')
  const [context, setContext] = useState('')
  const [brands, setBrands] = useState<BrandProfile[]>([])
  const [brandId, setBrandId] = useState('')
  const [result, setResult] = useState('')
  const [model, setModel] = useState('')
  const [evidenceCount, setEvidenceCount] = useState(0)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    let cancelled = false
    fetch(currentRegionId ? `/api/brand-profiles?region_id=${encodeURIComponent(currentRegionId)}` : '/api/brand-profiles', { cache: 'no-store' })
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return
        const rows = (data?.profiles ?? []) as BrandProfile[]
        setBrands(rows)
        setBrandId(rows.find((row) => row.is_default)?.id ?? rows[0]?.id ?? '')
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [currentRegionId])

  async function generate() {
    if (!topic.trim()) return
    setLoading(true)
    try {
      const response = await fetch('/api/generate/seo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic, context, brandProfileId: brandId || undefined, regionId: currentRegionId || undefined }),
      })
      const data = await response.json() as { text?: string; model?: string; evidenceItems?: number; error?: string }
      if (!response.ok) throw new Error(data.error ?? 'Не удалось создать SEO-статью')
      setResult(data.text ?? '')
      setModel(data.model ?? '')
      setEvidenceCount(data.evidenceItems ?? 0)
      toast.success('SEO-статья создана и сохранена в истории.', 'Готово')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Неизвестная ошибка', 'SEO-статья')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Layout>
      <div className="mx-auto flex w-full max-w-[1500px] flex-col gap-6">
        <section className="m3-card p-6 sm:p-8">
          <span className="aug-eyebrow">SEO / AEO / GEO</span>
          <h1 className="mt-3 text-3xl font-extrabold tracking-tight">SEO-статья</h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-on-surface-variant">
            1 800–3 500 слов · ответы на реальные вопросы · краткое резюме · факты из базы Amado · естественная интеграция продукта без рекламного тона.
          </p>
        </section>

        <div className="grid gap-6 xl:grid-cols-[420px_minmax(0,1fr)]">
          <section className="m3-card p-6">
            <label className="aug-field">
              <span>Тема и поисковый запрос</span>
              <textarea value={topic} onChange={(e) => setTopic(e.target.value)} rows={5} placeholder="Например: как организовать контроль продаж в небольшой компании" />
            </label>
            <label className="aug-field mt-4">
              <span>Дополнительный контекст</span>
              <textarea value={context} onChange={(e) => setContext(e.target.value)} rows={7} placeholder="Продуктовый угол, аудитория, исходные тезисы, обязательные факты…" />
            </label>
            <label className="aug-field mt-4">
              <span>Бренд</span>
              <select value={brandId} onChange={(e) => setBrandId(e.target.value)}>
                {brands.map((brand) => <option key={brand.id} value={brand.id}>{brand.brand_name}</option>)}
              </select>
            </label>
            <button type="button" className="aug-button aug-button--primary mt-5" onClick={generate} disabled={loading || !topic.trim()} aria-busy={loading}>
              {loading ? 'Собираю статью…' : 'Создать SEO-статью'}
            </button>
          </section>

          <section className="m3-card min-h-[650px] p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <span className="aug-eyebrow">Черновик</span>
                <h2 className="mt-2 text-xl font-bold">Экспертная статья</h2>
              </div>
              {result ? <button type="button" className="aug-button aug-button--secondary" onClick={() => navigator.clipboard.writeText(result)}>Копировать</button> : null}
            </div>
            {model ? <p className="mt-2 text-xs text-on-surface-variant">Модель: {model} · источников: {evidenceCount}</p> : null}
            <div className="mt-5 whitespace-pre-wrap text-sm leading-7">{result || 'После генерации здесь появится черновик. Материал также сохранится в истории.'}</div>
          </section>
        </div>
      </div>
    </Layout>
  )
}
