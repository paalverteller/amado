/* eslint-disable react-hooks/set-state-in-effect */
'use client'

import { useState, useEffect, useRef, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Layout from '@/components/Layout'
import { PromptTemplate } from '@/lib/domain/prompt-template'
import { BrandProfile } from '@/lib/domain/brand-profile'
import { useMarket } from '@/lib/market-context'
const FORMATS = [
  { value: 'article', label: 'Статья' },
  { value: 'linkedin_post', label: 'LinkedIn' },
  { value: 'instagram_caption', label: 'Instagram — подпись' },
  { value: 'instagram_carousel', label: 'Instagram — карусель' },
  { value: 'x_thread', label: 'X — тред' },
  { value: 'facebook_post', label: 'Facebook' },
  { value: 'telegram_post', label: 'Telegram' },
  { value: 'short_video_script', label: 'Короткое видео — сценарий' },
  { value: 'email', label: 'Email' },
  { value: 'quick_note', label: 'Короткая заметка' },
]

type ThreadSegment = string
type CarouselSegment = { title: string; body: string }

type UsedContext = {
  brandFacts: { category: string; label: string }[]
  knowledgeChunks: { chunkId?: string; assetId: string; assetTitle: string; snippet: string }[]
  competitorSignals?: { evidenceId: string; competitor: string; title: string; publishedAt: string | null }[]
}

type StreamMetadata = {
  contentRequestId: string | null
  articleId: string | null
  usedContext: UsedContext
}

type ThreadVersion = {
  id: string
  refinement_note: string | null
  generated_content: string | null
  created_at: string
}

function parseAIChunk(raw: string): string {
  let out = ''
  for (const line of raw.split('\n')) {
    if (line.startsWith('0:')) {
      try { out += JSON.parse(line.slice(2)) as string } catch { /* skip */ }
    }
  }
  return out
}

function SegmentedOutput({ contentType, raw }: { contentType: string; raw: string }) {
  let segments: (ThreadSegment | CarouselSegment)[] = []
  let parseError = false

  try {
    const cleaned = raw.trim().replace(/^```json\s*/i, '').replace(/```\s*$/, '')
    segments = JSON.parse(cleaned)
    if (!Array.isArray(segments)) throw new Error('not array')
  } catch {
    parseError = true
  }

  if (parseError) {
    return (
      <div className="text-base leading-relaxed text-on-surface whitespace-pre-wrap">
        {raw}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      {segments.map((seg, i) => (
        <div
          key={i}
          className="rounded-xl p-4"
          style={{ background: 'var(--color-surface-container-low)', border: '1px solid rgba(110,92,246,0.12)' }}
        >
          <div className="flex items-center gap-2 mb-2">
            <span
              style={{
                width: 22, height: 22, borderRadius: '50%',
                background: 'var(--color-primary)', color: '#fff',
                fontSize: 11, fontWeight: 700,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              {i + 1}
            </span>
            <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-on-surface-variant)' }}>
              {contentType === 'x_thread' ? `Пост ${i + 1}/${segments.length}` : `Слайд ${i + 1}/${segments.length}`}
            </span>
          </div>
          {typeof seg === 'string' ? (
            <p className="m-0 text-sm leading-relaxed text-on-surface">{seg}</p>
          ) : (
            <>
              <p className="m-0 font-bold text-sm mb-1 text-on-surface">{seg.title}</p>
              {seg.body && <p className="m-0 text-sm leading-relaxed text-on-surface-variant">{seg.body}</p>}
            </>
          )}
        </div>
      ))}
    </div>
  )
}

function GenerateContent() {
  const searchParams = useSearchParams()
  const abortRef = useRef<AbortController | null>(null)
  const { regions, marketCode } = useMarket()
  const currentRegionId = regions.find((r) => r.code === marketCode)?.id ?? null

  const [topic, setTopic] = useState(() => {
    const t = searchParams.get('topic')
    return t ? decodeURIComponent(t) : ''
  })
  const [promptContext] = useState(() => {
    const c = searchParams.get('context')
    return c ? decodeURIComponent(c) : ''
  })
  const evidenceId = searchParams.get('evidenceId')
  const campaignId = searchParams.get('campaignId')

  const [contentType, setContentType] = useState('article')
  const [templateId, setTemplateId] = useState('')
  const [brandProfileId, setBrandProfileId] = useState('')

  const [templates, setTemplates] = useState<PromptTemplate[]>([])
  const [brandProfiles, setBrandProfiles] = useState<BrandProfile[]>([])

  const [loading, setLoading] = useState(false)
  const [output, setOutput] = useState('')
  const [error, setError] = useState('')
  const [articleId, setArticleId] = useState<string | null>(null)
  const [rating, setRating] = useState(0)
  const [copied, setCopied] = useState(false)
  const [aiCheck, setAiCheck] = useState<{
    score: number; verdictLabel: string;
    flags: { type: string; excerpt: string; suggestion: string }[];
    summary: string;
  } | null>(null)
  const [aiCheckLoading, setAiCheckLoading] = useState(false)
  const [aiCheckError, setAiCheckError] = useState('')
  const [seoMode, setSeoMode] = useState(false)
  const [localizationNotes, setLocalizationNotes] = useState('')

  // Sprint 8: visible context, refinement, version history
  const [contentRequestId, setContentRequestId] = useState<string | null>(null)
  const [usedContext, setUsedContext] = useState<UsedContext | null>(null)
  const [showContext, setShowContext] = useState(false)
  const [threadVersions, setThreadVersions] = useState<ThreadVersion[]>([])
  const [refinementNote, setRefinementNote] = useState('')
  const [refining, setRefining] = useState(false)

  function loadThread(requestId: string) {
    fetch(`/api/generate/requests/${requestId}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d: { thread: ThreadVersion[] }) => setThreadVersions(d.thread ?? []))
      .catch(() => { /* version history is a nice-to-have, fail silently */ })
  }

  // Hydrate local storage states
  useEffect(() => {
    const savedFmt = localStorage.getItem('amado_format')
    if (!savedFmt) return
    const legacy: Record<string, string> = {
      blog_post: 'article', note: 'quick_note', social_post: 'linkedin_post', thread: 'x_thread', carousel: 'instagram_carousel',
    }
    const canonical = FORMATS.some((format) => format.value === savedFmt) ? savedFmt : (legacy[savedFmt] ?? 'article')
    setContentType(canonical)
  }, [])

  useEffect(() => {
    localStorage.setItem('amado_format', contentType)
  }, [contentType])

  useEffect(() => {
    if (templateId) localStorage.setItem('amado_template', templateId)
  }, [templateId])

  useEffect(() => {
    if (brandProfileId) localStorage.setItem('amado_brand_profile', brandProfileId)
  }, [brandProfileId])

  useEffect(() => {
    // Sprint 12 Phase 4: scope the brand dropdown to the selected market.
    // currentRegionId starts null on first render (regions haven't loaded
    // from /api/regions yet) -- that's fine, it just means "show every
    // brand" until MarketProvider resolves the cookie, same as before this
    // phase. Re-runs whenever the market switcher changes selection, so
    // switching markets refreshes which brands are selectable.
    const url = currentRegionId ? `/api/brand-profiles?region_id=${encodeURIComponent(currentRegionId)}` : '/api/brand-profiles'
    fetch(url)
      .then((r) => r.json() as Promise<{ profiles: BrandProfile[] }>)
      .then((d) => {
        const profiles = d.profiles ?? []
        setBrandProfiles(profiles)
        const savedBp = localStorage.getItem('amado_brand_profile')
        if (savedBp && profiles.some((p: BrandProfile) => p.id === savedBp)) {
          setBrandProfileId(savedBp)
        } else {
          const fallback = profiles.find((profile: BrandProfile) => profile.is_default && profile.is_active)
            ?? profiles.find((profile: BrandProfile) => profile.is_active)
          setBrandProfileId(fallback ? fallback.id : '')
        }
      })
      .catch(() => {})
  }, [currentRegionId])

  useEffect(() => {
    fetch('/api/templates')
      .then((r) => r.json() as Promise<{ templates: PromptTemplate[] }>)
      .then((d) => {
        setTemplates(d.templates ?? [])
        const savedTpl = localStorage.getItem('amado_template')
        if (savedTpl && d.templates?.some((t: PromptTemplate) => t.id === savedTpl)) {
          setTemplateId(savedTpl)
        } else {
          const def = d.templates?.find((t: PromptTemplate) => t.is_default)
          if (def) setTemplateId(def.id)
        }
      })
      .catch(() => {})
  }, [])

  async function handleGenerate(e?: React.FormEvent, refinement?: { parentRequestId: string; note: string }) {
    if (e) e.preventDefault()
    if (!topic.trim() || loading) return
    if (refinement && !refinement.note.trim()) return

    if (abortRef.current) abortRef.current.abort()
    const controller = new AbortController()
    abortRef.current = controller

    setLoading(true)
    setOutput('')
    setError('')
    setArticleId(null)
    setRating(0)
    setLocalizationNotes('')
    setContentRequestId(null)
    setUsedContext(null)
    if (!refinement) setThreadVersions([])

    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic,
          context: promptContext || undefined,
          contentType,
          templateId,
          brandProfileId: brandProfileId || undefined,
          regionId: currentRegionId || undefined,
          seoMode,
          parentRequestId: refinement?.parentRequestId,
          refinementNote: refinement?.note,
          evidenceItemIds: evidenceId ? [evidenceId] : undefined,
          marketingCampaignId: campaignId || undefined,
        }),
        signal: controller.signal,
      })

      if (!res.ok) {
        const err = await res.json() as { error: string }
        throw new Error(err.error ?? 'Ошибка генерации')
      }

      const reader = res.body!.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let capturedMetadata: StreamMetadata | null = null

      while (true) {
        const { value, done } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })

        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''

        for (const line of lines) {
          if (line.startsWith('0:')) {
            try { setOutput((prev) => prev + (JSON.parse(line.slice(2)) as string)) } catch { /* skip */ }
          } else if (line.startsWith('m:')) {
            try { capturedMetadata = JSON.parse(line.slice(2)) as StreamMetadata } catch { /* skip */ }
          } else if (line.trim() && !line.startsWith('d:') && !line.startsWith('e:')) {
            setOutput((prev) => prev + line + '\n')
          }
        }
      }

      if (buffer) {
        const parsed = parseAIChunk(buffer)
        if (parsed) setOutput((prev) => prev + parsed)
        else if (buffer.trim()) setOutput((prev) => prev + buffer)
      }

      if (capturedMetadata) {
        setContentRequestId(capturedMetadata.contentRequestId)
        setUsedContext(capturedMetadata.usedContext)
        setArticleId(capturedMetadata.articleId)
        if (capturedMetadata.contentRequestId) loadThread(capturedMetadata.contentRequestId)

        if (capturedMetadata.articleId) {
          try {
            const h = await fetch(`/api/articles/${capturedMetadata.articleId}`)
            if (h.ok) {
              const d = await h.json() as { source_context?: string | null }
              if (d.source_context) setLocalizationNotes(d.source_context)
            }
          } catch { /* non-critical */ }
        }
      }
    } catch (err) {
      const e = err as Error
      if (e.name !== 'AbortError') setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  async function handleRefine() {
    if (!contentRequestId || !refinementNote.trim()) return
    const note = refinementNote.trim()
    setRefining(true)
    try {
      await handleGenerate(undefined, { parentRequestId: contentRequestId, note })
      setRefinementNote('')
    } finally {
      setRefining(false)
    }
  }

  async function handleRate(score: number) {
    setRating(score)
    if (!articleId) return
    await fetch(`/api/articles/${articleId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rating: score }),
    }).catch(() => {})
  }

  async function handleCopy() {
    await navigator.clipboard.writeText(output).catch(() => {})
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  async function handleAiCheck() {
    setAiCheckError('')
    setAiCheck(null)
    setAiCheckLoading(true)
    try {
      const selectedBrand = brandProfiles.find((p) => p.id === brandProfileId)
      const res = await fetch('/api/ai-check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: output,
          brandVoice: selectedBrand?.voice_description,
          forbiddenWords: selectedBrand?.forbidden_words,
          examples: selectedBrand?.example_posts,
          regionId: currentRegionId || undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Ошибка проверки')
      setAiCheck(data)
    } catch (e) {
      setAiCheckError(e instanceof Error ? e.message : 'Неизвестная ошибка')
    } finally {
      setAiCheckLoading(false)
    }
  }

  const selectedTemplate = templates.find((t) => t.id === templateId)

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-on-background">
          Генерация контента
        </h1>
        <p className="mt-1 text-base text-on-surface-variant">
          Введите тему — Amado создаст черновик для выбранного рынка
        </p>
      </div>

      <form onSubmit={handleGenerate} className="m3-card p-6 space-y-5 shadow-sm">

        {/* Topic */}
        <div>
          <label className="block text-sm font-medium mb-1.5 text-on-surface-variant">
            Тема материала
          </label>
          <textarea
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="Например: как повысить конверсию интернет-магазина с помощью WhatsApp"
            rows={3}
            disabled={loading}
            className="m3-input-outlined w-full resize-none min-h-[80px]"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Format */}
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wider mb-1.5 text-on-surface-variant">
              Формат
            </label>
            <select
              value={contentType}
              onChange={(e) => setContentType(e.target.value)}
              disabled={loading}
              className="m3-input-outlined w-full appearance-none cursor-pointer"
            >
              {FORMATS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
            </select>
          </div>

          {/* Profile */}
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wider mb-1.5 text-on-surface-variant">
              Профиль промпта
            </label>
            <select
              value={templateId}
              onChange={(e) => setTemplateId(e.target.value)}
              disabled={loading}
              className="m3-input-outlined w-full appearance-none cursor-pointer"
            >
              <option value="">— Без профиля —</option>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
            {selectedTemplate && (
              <p className="text-[11px] mt-1.5 line-clamp-1 text-on-surface-variant/80 font-medium">
                {(selectedTemplate.tone_description || '').split(/\s+/).slice(0, 3).join(' ') + (selectedTemplate.tone_description.split(/\s+/).length > 3 ? '...' : '')}
              </p>
            )}
            {templates.length === 0 && (
              <p className="text-[11px] mt-1.5 text-error font-medium">
                Профили не загружены
              </p>
            )}
          </div>
        </div>

        {/* Brand Profile */}
        <div>
          <label className="block text-[11px] font-semibold uppercase tracking-wider mb-1.5 text-on-surface-variant">
            Бренд
          </label>
          <select
            value={brandProfileId}
            onChange={(e) => setBrandProfileId(e.target.value)}
            disabled={loading}
            className="m3-input-outlined w-full appearance-none cursor-pointer"
          >
            <option value="">— Без бренда —</option>
            {brandProfiles.map((p) => (
              <option key={p.id} value={p.id}>
                {p.brand_name}
              </option>
            ))}
          </select>
          {brandProfiles.length === 0 && (
            <p className="text-[11px] mt-1.5 text-error font-medium">
              Для этого рынка нет бренда. Добавьте его в настройках.
            </p>
          )}
        </div>

        {/* SEO Toggle */}
        <button
          type="button"
          onClick={() => setSeoMode((v) => !v)}
          style={{
            display: 'flex', alignItems: 'center', gap: '0.625rem',
            width: '100%', padding: '0.6rem 1rem', borderRadius: 12,
            border: seoMode ? '1.5px solid #6E5CF6' : '1.5px solid rgba(110,92,246,0.2)',
            background: seoMode ? 'rgba(110,92,246,0.08)' : 'transparent',
            cursor: 'pointer', transition: 'all 180ms ease',
            fontSize: 13, fontWeight: 600,
            color: seoMode ? 'var(--color-primary)' : 'var(--color-on-surface-variant)',
          }}
        >
          <div style={{
            width: 36, height: 20, borderRadius: 10, flexShrink: 0,
            position: 'relative',
            background: seoMode ? '#6E5CF6' : 'rgba(0,0,0,0.15)',
            transition: 'background 180ms ease',
          }}>
            <div style={{
              position: 'absolute', top: 2,
              left: seoMode ? 18 : 2,
              width: 16, height: 16, borderRadius: '50%',
              background: '#fff', transition: 'left 180ms ease',
              boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
            }} />
          </div>
          <span>Режим SEO</span>
          {seoMode && (
            <span style={{
              marginLeft: 'auto', fontSize: 10, fontWeight: 700,
              padding: '2px 7px', borderRadius: 6,
              background: '#6E5CF6', color: '#fff',
            }}>Вкл.</span>
          )}
        </button>

        <button
          type="submit"
          disabled={loading || !topic.trim()}
          className={`w-full m3-button-filled mt-2 text-base h-12 ${loading || !topic.trim() ? 'opacity-50 cursor-not-allowed bg-surface-variant text-on-surface-variant hover:shadow-none hover:bg-surface-variant' : ''}`}
        >
          {loading ? 'Создаю…' : 'Создать материал'}
        </button>
      </form>

      {error && (
        <div className="p-4 rounded-xl text-sm bg-error-container text-on-error-container font-medium">
          {error}
        </div>
      )}

      {(output || loading) && (
        <div className="m3-card p-8 shadow-sm">

          {/* Output: segmented (thread/carousel) vs plain text */}
          {!loading && (contentType === 'x_thread' || contentType === 'instagram_carousel') && output ? (
            <SegmentedOutput contentType={contentType} raw={output} />
          ) : (
            <div className="text-base leading-relaxed text-on-surface whitespace-pre-wrap">
              {output}
              {loading && (
                <span className="inline-block w-0.5 h-4 ml-0.5 align-middle bg-primary animate-blink" />
              )}
            </div>
          )}

          {output && (
            <div className="mt-4 text-xs font-medium text-on-surface-variant text-right">
              Знаков: {output.length}
            </div>
          )}

          {/* Sprint 8: what context was actually used */}
          {!loading && usedContext && (usedContext.brandFacts.length > 0 || usedContext.knowledgeChunks.length > 0 || (usedContext.competitorSignals?.length ?? 0) > 0) && (
            <div className="mt-4 pt-4 border-t border-surface-variant/50">
              <button
                type="button"
                onClick={() => setShowContext((v) => !v)}
                className="text-xs font-semibold bg-transparent border-none cursor-pointer p-0"
                style={{ color: 'var(--color-primary)' }}
              >
                {showContext ? '▾' : '▸'} Использованный контекст ({usedContext.brandFacts.length + usedContext.knowledgeChunks.length + (usedContext.competitorSignals?.length ?? 0)})
              </button>
              {showContext && (
                <div className="mt-2 flex flex-col gap-2 text-xs" style={{ color: 'var(--color-on-surface-variant)' }}>
                  {usedContext.brandFacts.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {usedContext.brandFacts.map((f, i) => (
                        <span key={i} className="rounded-full px-2 py-0.5" style={{ background: 'var(--color-surface-container-low)' }}>
                          {f.label}
                        </span>
                      ))}
                    </div>
                  )}
                  {usedContext.knowledgeChunks.map((c) => (
                    <div key={c.assetId} className="rounded-lg p-2" style={{ background: 'var(--color-surface-container-low)' }}>
                      <span className="font-semibold">{c.assetTitle}</span>
                      <p className="m-0 mt-0.5">{c.snippet}</p>
                    </div>
                  ))}
                  {(usedContext.competitorSignals?.length ?? 0) > 0 && (
                    <div className="rounded-lg p-2" style={{ background: 'var(--color-surface-container-low)' }}>
                      <span className="font-semibold">Сигналы конкурентов</span>
                      {usedContext.competitorSignals!.map((c) => (
                        <p key={c.evidenceId} className="m-0 mt-0.5">{c.competitor}: {c.title}</p>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Sprint 8: refine this version */}
          {!loading && output && contentRequestId && (
            <div className="mt-4 pt-4 border-t border-surface-variant/50 flex flex-col gap-2">
              <span className="text-xs font-semibold" style={{ color: 'var(--color-on-surface)' }}>Уточнить версию</span>
              <div className="flex gap-2">
                <input
                  value={refinementNote}
                  onChange={(e) => setRefinementNote(e.target.value)}
                  placeholder="Например: короче, более неформальный тон..."
                  className="m3-input-outlined flex-1 text-sm h-10"
                  onKeyDown={(e) => { if (e.key === 'Enter') handleRefine() }}
                />
                <button
                  type="button"
                  onClick={handleRefine}
                  disabled={refining || !refinementNote.trim()}
                  className="m3-button-tonal text-sm px-4 disabled:opacity-50"
                >
                  {refining ? '...' : 'Уточнить'}
                </button>
              </div>
            </div>
          )}

          {/* Sprint 8: version history within this thread */}
          {!loading && threadVersions.length > 1 && (
            <div className="mt-4 pt-4 border-t border-surface-variant/50">
              <span className="text-xs font-semibold" style={{ color: 'var(--color-on-surface)' }}>
                История версий ({threadVersions.length})
              </span>
              <div className="mt-2 flex flex-col gap-1">
                {threadVersions.map((v, i) => (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => v.generated_content && setOutput(v.generated_content)}
                    disabled={!v.generated_content}
                    className="text-left text-xs rounded-lg px-2 py-1.5 bg-transparent border-none cursor-pointer disabled:cursor-default"
                    style={{ color: 'var(--color-on-surface-variant)' }}
                  >
                    {i === 0 ? 'Версия 1 (исходная)' : `Версия ${i + 1}: ${v.refinement_note ?? ''}`}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Localization Notes */}
          {!loading && localizationNotes && (
            <div className="mt-6 pt-6 border-t border-surface-variant/50">
              <div className="flex items-center gap-2 mb-3">
                <svg fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4 text-primary">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 18v-5.25m0 0a6.01 6.01 0 0 0 1.5-.189m-1.5.189a6.01 6.01 0 0 1-1.5-.189m3.75 7.478a12.06 12.06 0 0 1-4.5 0m3.75 2.383a14.406 14.406 0 0 1-3 0M14.25 18v-.192c0-.983.658-1.823 1.508-2.316a7.5 7.5 0 1 0-7.517 0c.85.493 1.509 1.333 1.509 2.316V18" />
                </svg>
                <span className="text-sm font-bold" style={{ color: 'var(--color-on-surface)' }}>
                  Заметки по локализации
                </span>
              </div>
              <p className="text-sm m-0" style={{ color: 'var(--color-on-surface-variant)', lineHeight: 1.6 }}>
                {localizationNotes}
              </p>
            </div>
          )}

          {!loading && output && (
            <div className="mt-8 pt-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 border-t border-surface-variant/50">

              {/* Stars */}
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium text-on-surface-variant">Оценка:</span>
                <div className="flex gap-0.5">
                  {[1, 2, 3, 4, 5].map((st) => (
                    <button
                      key={st}
                      onClick={() => handleRate(st)}
                      className="text-2xl transition-transform duration-200 ease-m3-emphasized hover:scale-110 active:scale-75 bg-transparent border-none cursor-pointer focus:outline-none"
                      style={{ color: rating >= st ? '#6E5CF6' : 'var(--color-surface-variant)' }}
                      aria-label={`${st} из 5`}
                    >
                      ★
                    </button>
                  ))}
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex items-center justify-end gap-2 sm:gap-3 w-full sm:w-auto">
                <button onClick={handleCopy} title="Копировать" className="flex items-center justify-center p-2 rounded-full w-10 h-10 bg-surface-container-high text-on-surface hover:bg-surface-variant border-none cursor-pointer transition-colors">
                  {copied ? (
                    <svg fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" /></svg>
                  ) : (
                    <svg fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 0 1-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 0 1 1.5.124m7.5 10.376h3.375c.621 0 1.125-.504 1.125-1.125V11.25c0-4.46-3.243-8.161-7.5-8.876a9.06 9.06 0 0 0-1.5-.124H9.375c-.621 0-1.125.504-1.125 1.125v3.5m7.5 10.375H9.375a1.125 1.125 0 0 1-1.125-1.125v-9.25m12 6.625v-1.875a3.375 3.375 0 0 0-3.375-3.375h-1.5a1.125 1.125 0 0 1-1.125-1.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H9.75" /></svg>
                  )}
                </button>
                <button onClick={() => handleGenerate()} title="Создать заново" className="flex items-center justify-center p-2 rounded-full w-10 h-10 bg-surface-container-high text-on-surface hover:bg-surface-variant border-none cursor-pointer transition-colors">
                  <svg fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" /></svg>
                </button>
                <button
                  onClick={handleAiCheck}
                  disabled={aiCheckLoading}
                  title="Проверить текст"
                  className="flex items-center justify-center p-2 rounded-full w-10 h-10 bg-surface-container-high text-on-surface hover:bg-surface-variant border-none cursor-pointer transition-colors disabled:opacity-50"
                >
                  {aiCheckLoading ? (
                    <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v3a5 5 0 00-5 5H4z"/></svg>
                  ) : (
                    <svg fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09Z"/><path strokeLinecap="round" strokeLinejoin="round" d="M18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 0 0-2.456 2.456Z"/></svg>
                  )}
                </button>
                {articleId && (
                  <a href={`/history/${articleId}`} title="История" className="flex items-center justify-center p-2 rounded-full w-10 h-10 bg-surface-container-high text-on-surface hover:bg-surface-variant border-none cursor-pointer text-inherit transition-colors">
                    <svg fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" /></svg>
                  </a>
                )}
              </div>
            </div>
          )}

          {aiCheckError && (
            <div className="mt-4 p-4 rounded-xl text-sm font-medium bg-error-container text-on-error-container">
              {aiCheckError}
            </div>
          )}

          {aiCheck && (
            <div className="mt-6 pt-6 border-t border-surface-variant/50">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-bold" style={{ color: 'var(--color-on-surface)' }}>
                  Проверка текста
                </span>
                <span
                  style={{
                    fontSize: 12, fontWeight: 700, padding: '4px 12px', borderRadius: 999,
                    background: aiCheck.score < 35
                      ? 'rgba(22,163,74,0.12)'
                      : aiCheck.score < 65
                        ? 'rgba(249,115,22,0.12)'
                        : 'rgba(220,38,38,0.12)',
                    color: aiCheck.score < 35 ? '#276131' : aiCheck.score < 65 ? '#7B5813' : '#A43F3F',
                  }}
                >
                  {aiCheck.verdictLabel} · {aiCheck.score}/100
                </span>
              </div>

              <p className="text-sm m-0 mb-3" style={{ color: 'var(--color-on-surface-variant)', lineHeight: 1.6 }}>
                {aiCheck.summary}
              </p>

              {aiCheck.flags.length > 0 && (
                <div className="space-y-2">
                  {aiCheck.flags.map((flag, i) => (
                    <div
                      key={i}
                      className="p-3 rounded-xl text-sm"
                      style={{ background: 'var(--color-surface-container-low)' }}
                    >
                      <div className="font-semibold mb-1" style={{ fontSize: 12, color: 'var(--color-primary)' }}>
                        {flag.type}
                      </div>
                      <div className="italic mb-1" style={{ color: 'var(--color-on-surface-variant)' }}>
                        «{flag.excerpt}»
                      </div>
                      <div style={{ color: 'var(--color-on-surface)' }}>
                        {flag.suggestion}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function GeneratePage() {
  return (
    <Layout>
      <div className="mb-6 flex flex-wrap gap-3">
        <a href="/generate/seo" className="aug-button aug-button--growth">SEO-статья</a>
        <a href="/settings#prompt-library" className="aug-button aug-button--secondary">Профили каналов</a>
      </div>
      <Suspense fallback={<div className="p-8 text-on-surface-variant font-medium">Загрузка…</div>}>
        <GenerateContent />
      </Suspense>
    </Layout>
  )
}