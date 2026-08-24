'use client'

import { useState } from 'react'
import AugustDialog from '@/components/ui/AugustDialog'
import { toast } from '@/components/ui/AugustFeedback'

type Profile = Record<string, string | boolean | null>
type Pillar = { id: string; name: string; purpose: string | null; risk_level: string | null; default_product_explicitness: string | null; active: boolean }
type Term = { id: string; term: string; policy: string; replacement: string | null; notes: string | null }

type Data = { profile: Profile; pillars: Pillar[]; terms: Term[] }

const PROFILE_FIELDS = [
  ['brand_name', 'Название бренда'],
  ['positioning', 'Позиционирование'],
  ['voice_description', 'Голос бренда'],
  ['target_audience', 'Целевая аудитория'],
  ['value_propositions', 'Ценность'],
  ['strategic_themes', 'Стратегические темы'],
  ['product_facts', 'Факты о продукте'],
  ['proof_points', 'Доказательства'],
  ['cta_library', 'Призывы к действию'],
  ['forbidden_words', 'Запрещённые слова'],
  ['glossary', 'Глоссарий'],
  ['legal_disclaimers', 'Юридические ограничения'],
  ['sensitive_topics', 'Чувствительные темы'],
  ['default_platform_rules', 'Общие правила площадок'],
  ['competitors', 'Конкуренты'],
  ['example_posts', 'Примеры'],
] as const

export default function BrandOsEditor({ brandId }: { brandId: string }) {
  const [open, setOpen] = useState(false)
  const [data, setData] = useState<Data | null>(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  async function openEditor() {
    if (!brandId) return
    setOpen(true)
    setLoading(true)
    try {
      const response = await fetch(`/api/brands/${brandId}/os`, { cache: 'no-store' })
      const body = await response.json()
      if (!response.ok) throw new Error(body?.error ?? 'Не удалось загрузить бренд')
      setData(body as Data)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Неизвестная ошибка', 'Бренд')
    } finally {
      setLoading(false)
    }
  }

  async function saveProfile() {
    if (!data) return
    setSaving(true)
    try {
      const response = await fetch(`/api/brands/${brandId}/os`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profile: data.profile }),
      })
      const body = await response.json()
      if (!response.ok) throw new Error(body?.error ?? 'Не удалось сохранить бренд')
      setData((current) => current ? { ...current, profile: body.profile } : current)
      toast.success('Основа бренда обновлена.')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Неизвестная ошибка', 'Бренд')
    } finally {
      setSaving(false)
    }
  }

  async function saveEntity(entity: 'pillar' | 'term', id: string, patch: Record<string, unknown>) {
    try {
      const response = await fetch(`/api/brands/${brandId}/os`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entity, id, patch }),
      })
      const body = await response.json()
      if (!response.ok) throw new Error(body?.error ?? 'Не удалось сохранить')
      toast.success(entity === 'pillar' ? 'Тема контента обновлена.' : 'Термин обновлён.')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Неизвестная ошибка', 'Бренд')
    }
  }

  return (
    <>
      <div className="mb-5 flex justify-end">
        <button type="button" className="aug-button aug-button--primary" onClick={openEditor} disabled={!brandId}>
          Редактировать бренд
        </button>
      </div>

      <AugustDialog
        open={open}
        onClose={() => setOpen(false)}
        title="Редактор бренда"
        eyebrow="Правила"
        description="Это живые данные, которые читает генерация. Изменения применяются к следующим материалам."
        size="wide"
        footer={(
          <>
            <button type="button" className="aug-button aug-button--secondary" onClick={() => setOpen(false)}>Закрыть</button>
            <button type="button" className="aug-button aug-button--primary" onClick={saveProfile} disabled={saving || !data}>{saving ? 'Сохраняю…' : 'Сохранить основу'}</button>
          </>
        )}
      >
        {loading ? <p className="text-sm text-on-surface-variant">Загрузка бренда…</p> : null}
        {data ? (
          <div className="space-y-8">
            <section>
              <h3 className="text-lg font-bold">Основа</h3>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                {PROFILE_FIELDS.map(([key, label]) => (
                  <label key={key} className={`aug-field ${['positioning','voice_description','target_audience','strategic_themes','product_facts','proof_points','legal_disclaimers','example_posts'].includes(key) ? 'md:col-span-2' : ''}`}>
                    <span>{label}</span>
                    {key === 'brand_name' || key === 'competitors'
                      ? <input value={String(data.profile[key] ?? '')} onChange={(e) => setData((current) => current ? { ...current, profile: { ...current.profile, [key]: e.target.value } } : current)} />
                      : <textarea rows={key === 'example_posts' ? 7 : 4} value={String(data.profile[key] ?? '')} onChange={(e) => setData((current) => current ? { ...current, profile: { ...current.profile, [key]: e.target.value } } : current)} />}
                  </label>
                ))}
              </div>
            </section>

            <section>
              <h3 className="text-lg font-bold">Темы контента</h3>
              <div className="mt-4 space-y-3">
                {data.pillars.map((pillar, index) => (
                  <div key={pillar.id} className="rounded-[18px] border border-surface-variant p-4">
                    <div className="grid gap-3 md:grid-cols-[220px_minmax(0,1fr)_120px]">
                      <input className="rounded-xl border border-surface-variant px-3" value={pillar.name} onChange={(e) => setData((current) => current ? { ...current, pillars: current.pillars.map((row, i) => i === index ? { ...row, name: e.target.value } : row) } : current)} />
                      <input className="rounded-xl border border-surface-variant px-3" value={pillar.purpose ?? ''} onChange={(e) => setData((current) => current ? { ...current, pillars: current.pillars.map((row, i) => i === index ? { ...row, purpose: e.target.value } : row) } : current)} />
                      <button type="button" className="aug-button aug-button--secondary" onClick={() => saveEntity('pillar', pillar.id, { name: pillar.name, purpose: pillar.purpose, risk_level: pillar.risk_level, default_product_explicitness: pillar.default_product_explicitness, active: pillar.active })}>Сохранить</button>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section>
              <h3 className="text-lg font-bold">Терминология</h3>
              <div className="mt-4 space-y-3">
                {data.terms.map((term, index) => (
                  <div key={term.id} className="grid gap-3 rounded-[18px] border border-surface-variant p-4 md:grid-cols-[180px_140px_minmax(0,1fr)_120px]">
                    <input className="rounded-xl border border-surface-variant px-3" value={term.term} onChange={(e) => setData((current) => current ? { ...current, terms: current.terms.map((row, i) => i === index ? { ...row, term: e.target.value } : row) } : current)} />
                    <select className="rounded-xl border border-surface-variant px-3" value={term.policy} onChange={(e) => setData((current) => current ? { ...current, terms: current.terms.map((row, i) => i === index ? { ...row, policy: e.target.value } : row) } : current)}>
                      <option value="preferred">Предпочтительный</option>
                      <option value="allowed">Разрешённый</option>
                      <option value="discouraged">Нежелательный</option>
                      <option value="forbidden">Запрещённый</option>
                    </select>
                    <input className="rounded-xl border border-surface-variant px-3" value={term.replacement ?? ''} onChange={(e) => setData((current) => current ? { ...current, terms: current.terms.map((row, i) => i === index ? { ...row, replacement: e.target.value } : row) } : current)} placeholder="Замена" />
                    <button type="button" className="aug-button aug-button--secondary" onClick={() => saveEntity('term', term.id, { term: term.term, policy: term.policy, replacement: term.replacement, notes: term.notes })}>Сохранить</button>
                  </div>
                ))}
              </div>
            </section>
          </div>
        ) : null}
      </AugustDialog>
    </>
  )
}
