'use client'

import { useState } from 'react'
import Link from 'next/link'
import Layout from '@/components/Layout'
import { toast } from '@/components/ui/AugustFeedback'

export default function MarketAnalysisPage() {
  const [report, setReport] = useState('')
  const [loading, setLoading] = useState(false)
  const [meta, setMeta] = useState<{ model?: string; evidenceCount?: number; knowledgeAssetId?: string | null }>({})

  async function runAnalysis() {
    setLoading(true)
    try {
      const response = await fetch('/api/market/deep-analysis', { method: 'POST' })
      const data = await response.json() as { report?: string; model?: string; evidenceCount?: number; knowledgeAssetId?: string | null; error?: string }
      if (!response.ok) throw new Error(data.error ?? 'Analysis failed')
      setReport(data.report ?? '')
      setMeta(data)
      toast.success('Анализ собран на evidence за последние 60 дней.', 'Market Intelligence')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Неизвестная ошибка', 'Market Intelligence')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Layout>
      <div className="mx-auto flex w-full max-w-[1500px] flex-col gap-6">
        <section className="m3-card overflow-hidden p-6 sm:p-8">
          <span className="aug-eyebrow">Deep Market Intelligence</span>
          <h1 className="mt-3 max-w-4xl text-3xl font-extrabold tracking-tight">Тренды и бизнес-ландшафт PMEs Бразилии</h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-on-surface-variant">
            Строго последние 60 дней. Macro, новые бизнес-модели, digital, fintech, государственные программы, риски, поисковые темы и возможности — с traceable evidence из собственной базы Amado.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <button type="button" className="aug-button aug-button--primary" onClick={runAnalysis} disabled={loading} aria-busy={loading}>
              {loading ? 'Анализирую evidence…' : 'Собрать анализ за 60 дней'}
            </button>
            <Link href="/market" className="aug-button aug-button--secondary">Вернуться к рынку</Link>
          </div>
        </section>

        <section className="m3-card min-h-[650px] p-6 sm:p-8">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <span className="aug-eyebrow">Report</span>
              <h2 className="mt-2 text-xl font-bold">Brazil SME landscape</h2>
              {meta.model ? <p className="mt-2 text-xs text-on-surface-variant">Модель: {meta.model} · evidence: {meta.evidenceCount ?? 0}{meta.knowledgeAssetId ? ' · сохранено в Knowledge' : ''}</p> : null}
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
