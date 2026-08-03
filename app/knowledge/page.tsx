'use client'

import { useEffect, useRef, useState } from 'react'
import Layout from '@/components/Layout'
import { t } from '@/lib/i18n/config'
import type { KnowledgeAssetSummary, KnowledgeSearchResult } from '@/lib/domain/knowledge'

const CONTENT_TYPES = ['note', 'book', 'report', 'transcript', 'guideline', 'competitor_note', 'other'] as const
const RETRIEVAL_MODES = ['idea', 'evidence', 'brand'] as const

const STATUS_COLORS: Record<string, { bg: string; fg: string }> = {
  pending: { bg: '#F1F5F9', fg: '#64748B' },
  processing: { bg: '#FEF3C7', fg: '#B45309' },
  ready: { bg: '#DCFCE7', fg: '#15803D' },
  error: { bg: '#FEE2E2', fg: '#B91C1C' },
}

function contentTypeLabel(value: string): string {
  return t(`knowledge.content_type_${value}`)
}

function modeLabel(value: string): string {
  return t(`knowledge.mode_${value}`)
}

function statusLabel(value: string): string {
  return t(`knowledge.status_${value}`)
}

export default function KnowledgePage() {
  const [assets, setAssets] = useState<KnowledgeAssetSummary[]>([])
  const [assetsLoading, setAssetsLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)

  const [title, setTitle] = useState('')
  const [contentType, setContentType] = useState<(typeof CONTENT_TYPES)[number]>('note')
  const [collection, setCollection] = useState('')
  const [retrievalMode, setRetrievalMode] = useState<(typeof RETRIEVAL_MODES)[number]>('idea')
  const [rawText, setRawText] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [query, setQuery] = useState('')
  const [searching, setSearching] = useState(false)
  const [searchMode, setSearchMode] = useState<'semantic' | 'keyword' | null>(null)
  const [results, setResults] = useState<KnowledgeSearchResult[]>([])
  const [excluded, setExcluded] = useState<Set<string>>(new Set())
  const [copiedId, setCopiedId] = useState<string | null>(null)

  async function loadAssets() {
    setAssetsLoading(true)
    try {
      const res = await fetch('/api/knowledge')
      const data = await res.json().catch(() => ({}))
      setAssets(res.ok ? (data.items ?? []) : [])
    } catch {
      setAssets([])
    } finally {
      setAssetsLoading(false)
    }
  }

  useEffect(() => {
    // loadAssets synchronizes the page with the external Knowledge API.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadAssets()
  }, [])

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const text = await file.text()
    setRawText(text)
    if (!title.trim()) setTitle(file.name.replace(/\.(txt|md|markdown)$/i, ''))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim() || !rawText.trim() || submitting) return

    setSubmitting(true)
    setSubmitError('')
    try {
      const res = await fetch('/api/knowledge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          contentType,
          collection: collection.trim() || undefined,
          retrievalMode,
          rawText,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error ?? t('error.generic'))

      setTitle('')
      setCollection('')
      setRawText('')
      setContentType('note')
      setRetrievalMode('idea')
      if (fileInputRef.current) fileInputRef.current.value = ''
      await loadAssets()
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : t('error.generic'))
    } finally {
      setSubmitting(false)
    }
  }

  async function handleReindex(id: string) {
    setBusyId(id)
    try {
      await fetch(`/api/knowledge/${id}/reindex`, { method: 'POST' })
      await loadAssets()
    } finally {
      setBusyId(null)
    }
  }

  async function handleToggleActive(asset: KnowledgeAssetSummary) {
    setBusyId(asset.id)
    try {
      await fetch(`/api/knowledge/${asset.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: !asset.active }),
      })
      await loadAssets()
    } finally {
      setBusyId(null)
    }
  }

  async function handleDelete(id: string) {
    if (!window.confirm(t('knowledge.delete_confirm'))) return
    setBusyId(id)
    try {
      await fetch(`/api/knowledge/${id}`, { method: 'DELETE' })
      await loadAssets()
    } finally {
      setBusyId(null)
    }
  }

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    if (!query.trim() || searching) return
    setSearching(true)
    try {
      const res = await fetch('/api/knowledge/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: query.trim(), limit: 8 }),
      })
      const data = await res.json().catch(() => ({}))
      setResults(res.ok ? (data.items ?? []) : [])
      setSearchMode(res.ok ? data.mode ?? null : null)
      setExcluded(new Set())
    } finally {
      setSearching(false)
    }
  }

  function toggleExcluded(chunkId: string) {
    setExcluded((prev) => {
      const next = new Set(prev)
      if (next.has(chunkId)) next.delete(chunkId)
      else next.add(chunkId)
      return next
    })
  }

  async function handleCopy(chunkId: string, content: string) {
    try {
      await navigator.clipboard.writeText(content)
      setCopiedId(chunkId)
      setTimeout(() => setCopiedId((prev) => (prev === chunkId ? null : prev)), 1500)
    } catch {
      // Clipboard API can fail in insecure contexts — non-critical, just skip the confirmation.
    }
  }

  return (
    <Layout>
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--v2-color-text-primary)' }}>{t('knowledge.title')}</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--v2-color-text-secondary)' }}>{t('knowledge.subtitle')}</p>
        </div>

        {/* ── Upload form ── */}
        <form
          onSubmit={handleSubmit}
          className="rounded-lg border p-4 flex flex-col gap-3"
          style={{ borderColor: 'var(--v2-color-border-default)', background: 'var(--v2-color-surface-base)' }}
        >
          <h2 className="text-base font-semibold" style={{ color: 'var(--v2-color-text-primary)' }}>{t('knowledge.upload_title')}</h2>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1 text-sm">
              <span style={{ color: 'var(--v2-color-text-secondary)' }}>{t('knowledge.field_title')}</span>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={t('knowledge.placeholder_title')}
                className="rounded border px-3 py-2 text-sm"
                style={{ borderColor: 'var(--v2-color-border-strong)' }}
              />
            </label>

            <label className="flex flex-col gap-1 text-sm">
              <span style={{ color: 'var(--v2-color-text-secondary)' }}>{t('knowledge.field_collection')}</span>
              <input
                value={collection}
                onChange={(e) => setCollection(e.target.value)}
                className="rounded border px-3 py-2 text-sm"
                style={{ borderColor: 'var(--v2-color-border-strong)' }}
              />
            </label>

            <label className="flex flex-col gap-1 text-sm">
              <span style={{ color: 'var(--v2-color-text-secondary)' }}>{t('knowledge.field_content_type')}</span>
              <select
                value={contentType}
                onChange={(e) => setContentType(e.target.value as (typeof CONTENT_TYPES)[number])}
                className="rounded border px-3 py-2 text-sm"
                style={{ borderColor: 'var(--v2-color-border-strong)' }}
              >
                {CONTENT_TYPES.map((value) => (
                  <option key={value} value={value}>{contentTypeLabel(value)}</option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-1 text-sm">
              <span style={{ color: 'var(--v2-color-text-secondary)' }}>{t('knowledge.field_retrieval_mode')}</span>
              <select
                value={retrievalMode}
                onChange={(e) => setRetrievalMode(e.target.value as (typeof RETRIEVAL_MODES)[number])}
                className="rounded border px-3 py-2 text-sm"
                style={{ borderColor: 'var(--v2-color-border-strong)' }}
              >
                {RETRIEVAL_MODES.map((value) => (
                  <option key={value} value={value}>{modeLabel(value)}</option>
                ))}
              </select>
            </label>
          </div>

          <label className="flex flex-col gap-1 text-sm">
            <span style={{ color: 'var(--v2-color-text-secondary)' }}>{t('knowledge.field_text')}</span>
            <textarea
              value={rawText}
              onChange={(e) => setRawText(e.target.value)}
              placeholder={t('knowledge.placeholder_text')}
              rows={8}
              className="rounded border px-3 py-2 text-sm"
              style={{ borderColor: 'var(--v2-color-border-strong)', resize: 'vertical', fontFamily: 'inherit' }}
            />
          </label>

          <label className="flex flex-col gap-1 text-sm">
            <span style={{ color: 'var(--v2-color-text-secondary)' }}>{t('knowledge.upload_file')}</span>
            <input ref={fileInputRef} type="file" accept=".txt,.md,.markdown,text/plain,text/markdown" onChange={handleFileChange} className="text-sm" />
          </label>

          {submitError && (
            <p className="text-sm" style={{ color: 'var(--v2-color-danger)' }}>{submitError}</p>
          )}

          <button
            type="submit"
            disabled={submitting || !title.trim() || !rawText.trim()}
            className="self-start rounded px-4 py-2 text-sm font-semibold disabled:opacity-50"
            style={{ background: 'var(--v2-color-brand-primary)', color: '#fff' }}
          >
            {submitting ? t('knowledge.submitting') : t('knowledge.submit')}
          </button>
        </form>

        {/* ── Search ── */}
        <div
          className="rounded-lg border p-4 flex flex-col gap-3"
          style={{ borderColor: 'var(--v2-color-border-default)', background: 'var(--v2-color-surface-base)' }}
        >
          <h2 className="text-base font-semibold" style={{ color: 'var(--v2-color-text-primary)' }}>{t('knowledge.search_title')}</h2>

          <form onSubmit={handleSearch} className="flex gap-2">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t('knowledge.search_placeholder')}
              className="flex-1 rounded border px-3 py-2 text-sm"
              style={{ borderColor: 'var(--v2-color-border-strong)' }}
            />
            <button
              type="submit"
              disabled={searching || !query.trim()}
              className="rounded px-4 py-2 text-sm font-semibold disabled:opacity-50"
              style={{ background: 'var(--v2-color-brand-primary)', color: '#fff' }}
            >
              {t('knowledge.search_button')}
            </button>
          </form>

          {searchMode && (
            <span
              className="self-start inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold"
              style={{ background: '#DBEAFE', color: '#1E40AF' }}
            >
              {searchMode === 'semantic' ? t('knowledge.search_mode_semantic') : t('knowledge.search_mode_keyword')}
            </span>
          )}

          {!searching && searchMode && results.length === 0 && (
            <p className="text-sm" style={{ color: 'var(--v2-color-text-secondary)' }}>{t('knowledge.no_results')}</p>
          )}

          <div className="flex flex-col gap-2">
            {results.map((r) => {
              const isExcluded = excluded.has(r.chunk_id)
              return (
                <div
                  key={r.chunk_id}
                  className="rounded border p-3 text-sm flex flex-col gap-2"
                  style={{
                    borderColor: 'var(--v2-color-border-default)',
                    background: isExcluded ? 'var(--v2-color-surface-muted)' : 'var(--v2-color-surface-alt)',
                    opacity: isExcluded ? 0.55 : 1,
                  }}
                >
                  <div className="flex items-center justify-between gap-2">
                    <strong style={{ color: 'var(--v2-color-text-primary)' }}>{r.asset_title}</strong>
                    {r.similarity !== null && (
                      <span style={{ color: 'var(--v2-color-text-secondary)', fontSize: 12 }}>
                        {Math.round(r.similarity * 100)}%
                      </span>
                    )}
                  </div>
                  <p style={{ color: 'var(--v2-color-text-secondary)', whiteSpace: 'pre-wrap' }}>{r.content}</p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => toggleExcluded(r.chunk_id)}
                      className="rounded px-3 py-1 text-xs font-semibold"
                      style={{
                        border: '1px solid var(--v2-color-border-strong)',
                        background: 'transparent',
                        color: 'var(--v2-color-text-primary)',
                      }}
                    >
                      {isExcluded ? t('knowledge.use_chunk') : t('knowledge.exclude_chunk')}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleCopy(r.chunk_id, r.content)}
                      className="rounded px-3 py-1 text-xs font-semibold"
                      style={{
                        border: '1px solid var(--v2-color-border-strong)',
                        background: 'transparent',
                        color: 'var(--v2-color-text-primary)',
                      }}
                    >
                      {copiedId === r.chunk_id ? t('knowledge.copied') : t('knowledge.copy_chunk')}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* ── Asset list ── */}
        <div
          className="rounded-lg border p-4 flex flex-col gap-3"
          style={{ borderColor: 'var(--v2-color-border-default)', background: 'var(--v2-color-surface-base)' }}
        >
          <h2 className="text-base font-semibold" style={{ color: 'var(--v2-color-text-primary)' }}>{t('knowledge.assets_title')}</h2>

          {assetsLoading && <p className="text-sm" style={{ color: 'var(--v2-color-text-secondary)' }}>…</p>}
          {!assetsLoading && assets.length === 0 && (
            <p className="text-sm" style={{ color: 'var(--v2-color-text-secondary)' }}>{t('knowledge.no_assets')}</p>
          )}

          <div className="flex flex-col gap-2">
            {assets.map((asset) => {
              const colors = STATUS_COLORS[asset.processing_status] ?? STATUS_COLORS.pending
              const isBusy = busyId === asset.id
              return (
                <div
                  key={asset.id}
                  className="rounded border p-3 flex flex-wrap items-center gap-3 text-sm"
                  style={{ borderColor: 'var(--v2-color-border-default)', opacity: asset.active ? 1 : 0.5 }}
                >
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold truncate" style={{ color: 'var(--v2-color-text-primary)' }}>{asset.title}</div>
                    <div style={{ color: 'var(--v2-color-text-secondary)', fontSize: 12 }}>
                      {contentTypeLabel(asset.content_type)} · {modeLabel(asset.retrieval_mode)}
                      {asset.collection ? ` · ${asset.collection}` : ''}
                      {' · '}{asset.chunk_count} {t('knowledge.chunks_count')}
                    </div>
                  </div>

                  <span
                    className="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold"
                    style={{ background: colors.bg, color: colors.fg }}
                  >
                    {statusLabel(asset.processing_status)}
                  </span>

                  <button
                    type="button"
                    disabled={isBusy}
                    onClick={() => handleReindex(asset.id)}
                    className="rounded px-3 py-1 text-xs font-semibold disabled:opacity-50"
                    style={{ border: '1px solid var(--v2-color-border-strong)', background: 'transparent', color: 'var(--v2-color-text-primary)' }}
                  >
                    {t('knowledge.reindex')}
                  </button>

                  <button
                    type="button"
                    disabled={isBusy}
                    onClick={() => handleToggleActive(asset)}
                    className="rounded px-3 py-1 text-xs font-semibold disabled:opacity-50"
                    style={{ border: '1px solid var(--v2-color-border-strong)', background: 'transparent', color: 'var(--v2-color-text-primary)' }}
                  >
                    {asset.active ? t('status.active') : t('status.inactive')}
                  </button>

                  <button
                    type="button"
                    disabled={isBusy}
                    onClick={() => handleDelete(asset.id)}
                    className="rounded px-3 py-1 text-xs font-semibold disabled:opacity-50"
                    style={{ border: '1px solid rgba(220,38,38,0.4)', background: 'transparent', color: 'var(--v2-color-danger)' }}
                  >
                    {t('action.delete')}
                  </button>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </Layout>
  )
}
