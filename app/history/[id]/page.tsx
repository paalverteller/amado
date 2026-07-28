'use client'

import { useState, useEffect, use } from 'react'
import Link from 'next/link'
import Layout from '@/components/Layout'
import RatingWidget from '@/components/RatingWidget'
import { Article } from '@/lib/supabase'

type Tab = 'draft' | 'final'

const STATUS_OPTIONS: { value: Article['status']; label: string }[] = [
  { value: 'draft',     label: 'Rascunho' },
  { value: 'reviewed',  label: 'Revisado' },
  { value: 'published', label: 'Publicado' },
]

const STATUS_BADGE: Record<Article['status'], string> = {
  draft:     'bg-surface-variant text-on-surface-variant',
  reviewed:  'bg-tertiary-container text-on-tertiary-container',
  published: 'bg-primary-container text-on-primary-container',
}

const CONTENT_TYPE_LABELS: Record<string, string> = {
  blog_post: 'Blog', social_post: 'Redes Sociais', telegram_post: 'Telegram', case_review: 'Caso', article_comment: 'Comentário',
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('pt-BR', {
    day: 'numeric', month: 'long', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

interface PageProps { params: Promise<{ id: string }> }

export default function ArticlePage({ params }: PageProps) {
  const { id } = use(params)

  const [article, setArticle]         = useState<Article | null>(null)
  const [loading, setLoading]         = useState(true)
  const [activeTab, setActiveTab]     = useState<Tab>('draft')
  const [finalContent, setFinalContent] = useState('')
  const [savingFinal, setSavingFinal] = useState(false)
  const [savingStatus, setSavingStatus] = useState(false)
  const [savedMsg, setSavedMsg]       = useState('')
  const [copied, setCopied]           = useState(false)

  useEffect(() => {
    let cancelled = false
    fetch(`/api/articles/${id}`)
      .then((r) => { if (!r.ok) throw new Error('Conteúdo não encontrado'); return r.json() as Promise<Article> })
      .then((data) => { if (!cancelled) { setArticle(data); setFinalContent(data.final_content ?? '') } })
      .catch((err) => console.error('[article/id] load error:', err))
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [id])

  async function handleSaveFinal() {
    if (!article) return
    setSavingFinal(true)
    try {
      const res = await fetch(`/api/articles/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ final_content: finalContent }),
      })
      if (!res.ok) throw new Error('Erro ao salvar')
      const updated = await res.json() as Article
      setArticle(updated)
      setSavedMsg('Salvo ✓')
      setTimeout(() => setSavedMsg(''), 2000)
    } catch (err) {
      setSavedMsg(`Erro: ${(err as Error).message}`)
    } finally {
      setSavingFinal(false)
    }
  }

  async function handleStatusChange(newStatus: Article['status']) {
    if (!article) return
    setSavingStatus(true)
    try {
      const res = await fetch(`/api/articles/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus, published_at: newStatus === 'published' ? new Date().toISOString() : null }),
      })
      if (!res.ok) throw new Error('Erro ao atualizar')
      setArticle(await res.json() as Article)
    } catch (err) { console.error('[article/id] status error:', err) }
    finally { setSavingStatus(false) }
  }

  async function handleCopyDraft() {
    if (!article?.draft_content) return
    try {
      await navigator.clipboard.writeText(article.draft_content)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch { /* clipboard unavailable */ }
  }

  if (loading) {
    return (
      <Layout>
        <div className="animate-pulse space-y-4 max-w-3xl">
          <div className="h-6 bg-surface-variant/40 rounded w-24" />
          <div className="h-8 bg-surface-variant/40 rounded w-2/3" />
          <div className="h-64 bg-surface-variant/20 rounded-2xl" />
        </div>
      </Layout>
    )
  }

  if (!article) {
    return (
      <Layout>
        <div className="m3-card text-center py-16 px-4">
          <p className="mb-4 text-on-surface font-medium">Conteúdo não encontrado</p>
          <Link href="/history" className="text-primary underline text-sm">← Voltar ao histórico</Link>
        </div>
      </Layout>
    )
  }

  return (
    <Layout>
      <div className="max-w-3xl space-y-6">
        <Link href="/history" className="inline-flex items-center gap-1 text-sm text-on-surface-variant hover:text-on-surface transition-colors no-underline">
          ← Voltar ao histórico
        </Link>

        {/* Title + meta */}
        <div className="space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
            <h1 className="text-2xl font-bold text-on-background m-0" style={{ fontFamily: 'var(--font-display)' }}>
              {article.topic}
            </h1>
            <span className={`shrink-0 text-xs font-semibold px-3 py-1 rounded-full ${STATUS_BADGE[article.status]}`}>
              {STATUS_OPTIONS.find((s) => s.value === article.status)?.label}
            </span>
          </div>
          <div className="flex min-w-0 flex-wrap gap-x-4 gap-y-2 overflow-hidden text-xs font-medium text-on-surface-variant">
            <span className="bg-surface-container-high px-2 py-1 rounded-md">{formatDate(article.created_at)}</span>
            {article.content_type && <span className="bg-surface-container-high px-2 py-1 rounded-md">{CONTENT_TYPE_LABELS[article.content_type] ?? article.content_type}</span>}
            {article.generation_model && <span className="mt-1 max-w-full break-words uppercase tracking-wider [overflow-wrap:anywhere]">{article.generation_model}</span>}
          </div>
        </div>

        {/* Tabs */}
        <div className="border-b border-surface-variant/50">
          <div className="flex gap-2">
            {(['draft', 'final'] as Tab[]).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-5 py-2.5 text-sm font-medium transition-colors focus:outline-none border-b-2 ${
                  activeTab === tab
                    ? 'border-primary text-primary'
                    : 'border-transparent text-on-surface-variant hover:text-on-surface hover:bg-surface-variant/30 rounded-t-lg'
                }`}
              >
                {tab === 'draft' ? 'Rascunho IA' : 'Edição final'}
              </button>
            ))}
          </div>
        </div>

        {/* Tab content */}
        {activeTab === 'draft' ? (
          <div className="space-y-4">
            <div className="m3-card p-6 shadow-sm">
              {article.draft_content ? (
                <div className="max-w-full overflow-x-auto break-words text-base leading-relaxed text-on-surface whitespace-pre-wrap [overflow-wrap:anywhere]">
                  {article.draft_content}
                </div>
              ) : (
                <p className="text-on-surface-variant text-sm text-center py-4">Rascunho vazio</p>
              )}
            </div>
            {article.draft_content && (
              <div className="flex justify-end">
                <button onClick={handleCopyDraft} title="Copiar rascunho" className="flex items-center justify-center p-2 rounded-full w-10 h-10 bg-surface-container-high text-on-surface hover:bg-surface-variant border-none cursor-pointer transition-colors">
                  {copied ? (
                    <svg fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" /></svg>
                  ) : (
                    <svg fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 0 1-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 0 1 1.5.124m7.5 10.376h3.375c.621 0 1.125-.504 1.125-1.125V11.25c0-4.46-3.243-8.161-7.5-8.876a9.06 9.06 0 0 0-1.5-.124H9.375c-.621 0-1.125.504-1.125 1.125v3.5m7.5 10.375H9.375a1.125 1.125 0 0 1-1.125-1.125v-9.25m12 6.625v-1.875a3.375 3.375 0 0 0-3.375-3.375h-1.5a1.125 1.125 0 0 1-1.125-1.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H9.75" /></svg>
                  )}
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4 animate-[fadeIn_200ms_var(--ease-m3-standard)_forwards]">
            <textarea
              value={finalContent}
              onChange={(e) => setFinalContent(e.target.value)}
              placeholder="Cole ou escreva a versão final do conteúdo..."
              rows={20}
              className="m3-input-outlined min-h-[300px] w-full max-w-full resize-y break-words [overflow-wrap:anywhere]"
            />
            <div className="flex items-center gap-3">
              <button onClick={handleSaveFinal} disabled={savingFinal} className={`m3-button-filled ${savingFinal ? 'opacity-50 cursor-not-allowed' : ''}`}>
                {savingFinal ? 'Salvando...' : 'Salvar versão final'}
              </button>
              {savedMsg && <span className="text-sm font-medium text-on-surface-variant">{savedMsg}</span>}
            </div>
          </div>
        )}

        {/* Rating + Status */}
        <div className="m3-card p-6 shadow-sm space-y-6">
          <RatingWidget
            articleId={article.id}
            currentRating={article.rating}
            currentComment={article.comment}
            onSaved={(rating, comment) => setArticle((prev) => prev ? { ...prev, rating, comment } : prev)}
          />

          <div className="border-t border-surface-variant/50 pt-5">
            <label className="block text-sm font-medium text-on-surface-variant mb-2">
              Status do conteúdo
            </label>
            <div className="flex items-center gap-3">
              <select
                value={article.status}
                onChange={(e) => handleStatusChange(e.target.value as Article['status'])}
                disabled={savingStatus}
                className="m3-input-outlined w-48 appearance-none cursor-pointer"
              >
                {STATUS_OPTIONS.map(({ value, label }) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
              {savingStatus && <span className="text-xs font-medium text-on-surface-variant">Atualizando...</span>}
            </div>
          </div>
        </div>
      </div>
    </Layout>
  )
}
