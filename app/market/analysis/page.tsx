'use client'

import { useState } from 'react'
import Link from 'next/link'
import Layout from '@/components/Layout'
import { toast } from '@/components/ui/AugustFeedback'
import { useMarket } from '@/lib/market-context'

export default function MarketAnalysisPage() {
  const { regions, marketCode } = useMarket()
  const currentRegionId = regions.find((region) => region.code === marketCode)?.id ?? null
  const [report, setReport] = useState('')
  const [loading, setLoading] = useState(false)
  const [meta, setMeta] = useState<{ model?: string; evidenceCount?: number; knowledgeAssetId?: string | null }>({})

  async function runAnalysis() {
    setLoading(true)
    try {
      const response = await fetch('/api/market/deep-analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ regionId: currentRegionId || undefined }),
      })
      const data = await response.json() as { report?: string; model?: string; evidenceCount?: number; knowledgeAssetId?: string | null; error?: string }
      if (!response.ok) throw new Error(data.error ?? 'Не удалось собрать анализ')
      setReport(data.report ?? '')
      setMeta(data)
      toast.success('Анализ собран по источникам за последние 60 дней.', 'Анализ рынка')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Неизвестная ошибка', 'Анализ рынка')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Layout>
      <div className="mx-auto flex w-full max-w-[1500px] flex-col gap-6">
        <section className="m3-card overflow-hidden p-6 sm:p-8">
          <span className="aug-eyebrow">Глубокий анализ рынка</span>
          <h1 className="mt-3 max-w-4xl text-3xl font-extrabold tracking-tight">Тренды и бизнес-ландшафт</h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-on-surface-variant">
            Только последние 60 дней. Экономика, бизнес-модели, цифровые продукты, финтех, программы поддержки, риски, поисковые темы и возможности — на основе проверяемых источников из базы Amado.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <button type="button" className="aug-button aug-button--primary" onClick={runAnalysis} disabled={loading} aria-busy={loading}>
              {loading ? 'Анализирую источники…' : 'Собрать анализ за 60 дней'}
            </button>
            <Link href="/market" className="aug-button aug-button--secondary">Вернуться к рынку</Link>
          </div>
        </section>

        <section className="m3-card min-h-[650px] p-6 sm:p-8">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <span className="aug-eyebrow">Отчёт</span>
              <h2 className="mt-2 text-xl font-bold">Обзор рынка</h2>
              {meta.model ? <p className="mt-2 text-xs text-on-surface-variant">Модель: {meta.model} · источников: {meta.evidenceCount ?? 0}{meta.knowledgeAssetId ? ' · сохранено в базе знаний' : ''}</p> : null}
            </div>
            {report ? <button type="button" className="aug-button aug-button--secondary" onClick={() => navigator.clipboard.writeText(report)}>Копировать</button> : null}
          </div>
          <div className="mt-6 whitespace-pre-wrap text-sm leading-7">
            {report || 'Нажмите «Собрать анализ». Если свежих материалов мало, Amado остановится и попросит сначала обновить источники — он не будет додумывать рынок.'}
          </div>
        </section>
      </div>
    </Layout>
  )
}
