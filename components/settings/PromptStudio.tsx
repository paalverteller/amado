'use client'

import { useEffect, useMemo, useState } from 'react'
import AugustDialog from '@/components/ui/AugustDialog'
import { toast } from '@/components/ui/AugustFeedback'
import type { PromptTemplate } from '@/lib/domain/prompt-template'

type Draft = {
  id?: string
  name: string
  tone_description: string
  system_prompt: string
  content_types: string
  version: string
  is_active: boolean
  is_default: boolean
}

const EMPTY: Draft = {
  name: '',
  tone_description: '',
  system_prompt: '',
  content_types: '',
  version: 'custom-v1',
  is_active: true,
  is_default: false,
}

function toDraft(row: PromptTemplate): Draft {
  return {
    id: row.id,
    name: row.name,
    tone_description: row.tone_description ?? '',
    system_prompt: row.system_prompt ?? '',
    content_types: (row.content_types ?? []).join(', '),
    version: row.version ?? 'custom-v1',
    is_active: row.is_active,
    is_default: row.is_default,
  }
}

export default function PromptStudio() {
  const [items, setItems] = useState<PromptTemplate[]>([])
  const [query, setQuery] = useState('')
  const [draft, setDraft] = useState<Draft>(EMPTY)
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let cancelled = false
    fetch('/api/prompts', { cache: 'no-store' })
      .then(async (response) => {
        const data = await response.json()
        if (!response.ok) throw new Error(data?.error ?? 'Не удалось загрузить промпты')
        return Array.isArray(data) ? data as PromptTemplate[] : []
      })
      .then((rows) => { if (!cancelled) setItems(rows) })
      .catch((error) => { if (!cancelled) toast.error(error instanceof Error ? error.message : 'Ошибка загрузки') })
    return () => { cancelled = true }
  }, [])

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase()
    if (!needle) return items
    return items.filter((item) =>
      `${item.name} ${item.tone_description} ${(item.content_types ?? []).join(' ')}`.toLowerCase().includes(needle),
    )
  }, [items, query])

  async function reload() {
    const response = await fetch('/api/prompts', { cache: 'no-store' })
    const data = await response.json()
    if (!response.ok) throw new Error(data?.error ?? 'Не удалось загрузить промпты')
    setItems(Array.isArray(data) ? data as PromptTemplate[] : [])
  }

  function create() {
    setDraft(EMPTY)
    setOpen(true)
  }

  function edit(item: PromptTemplate) {
    setDraft(toDraft(item))
    setOpen(true)
  }

  async function save() {
    if (!draft.name.trim() || !draft.system_prompt.trim()) {
      toast.warning('Название и system prompt обязательны.')
      return
    }
    setSaving(true)
    try {
      const payload = {
        name: draft.name.trim(),
        tone_description: draft.tone_description.trim(),
        system_prompt: draft.system_prompt,
        content_types: draft.content_types.split(',').map((value) => value.trim()).filter(Boolean),
        version: draft.version.trim() || 'custom-v1',
        is_active: draft.is_active,
        is_default: draft.is_default,
      }
      const response = await fetch(draft.id ? `/api/prompts/${draft.id}` : '/api/prompts', {
        method: draft.id ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data?.error ?? 'Не удалось сохранить промпт')
      await reload()
      setOpen(false)
      toast.success(draft.id ? 'Профиль обновлён.' : 'Новый профиль создан.', 'Промпты')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Неизвестная ошибка', 'Промпты')
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <section id="prompt-library" className="m3-card mb-6 p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <span className="aug-eyebrow">Промпты</span>
            <h2 className="mt-2 text-2xl font-extrabold tracking-tight">Профили генерации</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-on-surface-variant">
              Правила каналов, локализация, SEO и анализ рынка хранятся как данные. Их можно менять без нового развёртывания.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <input
              className="min-h-11 rounded-xl border border-surface-variant bg-surface px-4 text-sm"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Найти профиль…"
            />
            <button type="button" className="aug-button aug-button--primary" onClick={create}>+ Новый промпт</button>
          </div>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {visible.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => edit(item)}
              className="rounded-[20px] border border-surface-variant bg-surface p-4 text-left transition hover:-translate-y-0.5"
            >
              <div className="flex items-start justify-between gap-3">
                <strong className="text-sm">{item.name}</strong>
                <span className={`rounded-full px-2 py-1 text-[10px] font-extrabold ${item.is_active ? 'bg-[var(--aug-status-success-bg)] text-[var(--aug-status-success-text)]' : 'bg-surface-container-high text-on-surface-variant'}`}>
                  {item.is_active ? 'ACTIVE' : 'OFF'}
                </span>
              </div>
              <p className="mt-2 line-clamp-2 text-xs leading-5 text-on-surface-variant">{item.tone_description || 'Без описания'}</p>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {(item.content_types ?? []).map((type) => <span key={type} className="rounded-full bg-primary-container px-2 py-1 text-[10px] font-bold text-on-primary-container">{type}</span>)}
              </div>
            </button>
          ))}
        </div>
      </section>

      <AugustDialog
        open={open}
        onClose={() => setOpen(false)}
        title={draft.id ? 'Редактировать промпт' : 'Новый промпт'}
        eyebrow="Промпты"
        description="Системный промпт применяется перед правилами бренда, источниками и контекстом задачи."
        size="wide"
        footer={(
          <>
            <button type="button" className="aug-button aug-button--secondary" onClick={() => setOpen(false)}>Отмена</button>
            <button type="button" className="aug-button aug-button--primary" onClick={save} disabled={saving} aria-busy={saving}>
              {saving ? 'Сохраняю…' : 'Сохранить'}
            </button>
          </>
        )}
      >
        <div className="grid gap-4 md:grid-cols-2">
          <label className="aug-field"><span>Название</span><input value={draft.name} onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))} /></label>
          <label className="aug-field"><span>Версия</span><input value={draft.version} onChange={(e) => setDraft((d) => ({ ...d, version: e.target.value }))} /></label>
          <label className="aug-field md:col-span-2"><span>Краткое назначение</span><input value={draft.tone_description} onChange={(e) => setDraft((d) => ({ ...d, tone_description: e.target.value }))} /></label>
          <label className="aug-field md:col-span-2">
            <span>Типы контента · через запятую</span>
            <input value={draft.content_types} onChange={(e) => setDraft((d) => ({ ...d, content_types: e.target.value }))} placeholder="linkedin_post, article, localization" />
          </label>
          <label className="aug-field md:col-span-2">
            <span>Системный промпт</span>
            <textarea value={draft.system_prompt} onChange={(e) => setDraft((d) => ({ ...d, system_prompt: e.target.value }))} rows={22} />
            <small>{draft.system_prompt.length.toLocaleString('ru-RU')} знаков</small>
          </label>
          <label className="flex items-center gap-3 text-sm"><input type="checkbox" checked={draft.is_active} onChange={(e) => setDraft((d) => ({ ...d, is_active: e.target.checked }))} /> Активен</label>
          <label className="flex items-center gap-3 text-sm"><input type="checkbox" checked={draft.is_default} onChange={(e) => setDraft((d) => ({ ...d, is_default: e.target.checked }))} /> Базовый профиль</label>
        </div>
      </AugustDialog>
    </>
  )
}
