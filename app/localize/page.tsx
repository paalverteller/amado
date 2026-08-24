'use client'

import { useEffect, useState } from 'react'
import Layout from '@/components/Layout'
import { toast } from '@/components/ui/AugustFeedback'
import type { PromptTemplate } from '@/lib/domain/prompt-template'
import type { BrandProfile } from '@/lib/domain/brand-profile'
import { useMarket } from '@/lib/market-context'

type ContextType = 'ui' | 'promo' | 'help' | 'pricing' | 'legal'

const TARGET_LOCALES: Record<string, { locale: string; label: string }> = {
  BR: { locale: 'pt-BR', label: 'Бразилия · pt-BR' },
  ES: { locale: 'es-ES', label: 'Испания · es-ES' },
  DE: { locale: 'de-DE', label: 'Германия · de-DE' },
  US: { locale: 'en-US', label: 'США · en-US' },
}

export default function LocalizePage() {
  const { regions, marketCode } = useMarket()
  const currentRegion = regions.find((region) => region.code === marketCode)
  const currentRegionId = currentRegion?.id ?? null
  const target = TARGET_LOCALES[marketCode] ?? {
    locale: currentRegion?.code ?? marketCode,
    label: currentRegion?.name ?? marketCode,
  }
  const [sourceText, setSourceText] = useState('')
  const [output, setOutput] = useState('')
  const [sourceLanguage, setSourceLanguage] = useState('auto')
  const [contextType, setContextType] = useState<ContextType>('promo')
  const [templates, setTemplates] = useState<PromptTemplate[]>([])
  const [templateId, setTemplateId] = useState('')
  const [brands, setBrands] = useState<BrandProfile[]>([])
  const [brandId, setBrandId] = useState('')
  const [model, setModel] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    let cancelled = false
    Promise.all([
      fetch('/api/prompts?contentType=localization', { cache: 'no-store' }).then((r) => r.json()),
      fetch(currentRegionId ? `/api/brand-profiles?region_id=${encodeURIComponent(currentRegionId)}` : '/api/brand-profiles', { cache: 'no-store' }).then((r) => r.json()),
    ]).then(([promptData, brandData]) => {
      if (cancelled) return
      const promptRows = Array.isArray(promptData) ? promptData as PromptTemplate[] : []
      const brandRows = (brandData?.profiles ?? []) as BrandProfile[]
      setTemplates(promptRows)
      setTemplateId(promptRows.find((item) => item.is_active)?.id ?? '')
      setBrands(brandRows)
      setBrandId(brandRows.find((item) => item.is_default)?.id ?? brandRows[0]?.id ?? '')
    }).catch((error) => {
      if (!cancelled) toast.error(error instanceof Error ? error.message : 'Не удалось загрузить профили')
    })
    return () => { cancelled = true }
  }, [currentRegionId])

  async function localize() {
    if (!sourceText.trim()) return
    setLoading(true)
    try {
      const response = await fetch('/api/localize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourceText,
          sourceLanguage,
          contextType,
          templateId: templateId || undefined,
          brandProfileId: brandId || undefined,
          regionId: currentRegionId || undefined,
        }),
      })
      const data = await response.json() as { localizedText?: string; model?: string; error?: string }
      if (!response.ok) throw new Error(data.error ?? 'Не удалось локализовать текст')
      setOutput(data.localizedText ?? '')
      setModel(data.model ?? '')
      toast.success(`Текст локализован: ${target.label}.`, 'Готово')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Неизвестная ошибка', 'Локализация не выполнена')
    } finally {
      setLoading(false)
    }
  }

  async function copy() {
    await navigator.clipboard.writeText(output)
    toast.success('Локализованный текст скопирован.')
  }

  return (
    <Layout>
      <div className="mx-auto flex w-full max-w-[1500px] flex-col gap-6">
        <section className="m3-card p-6 sm:p-8">
          <span className="aug-eyebrow">Локализация</span>
          <h1 className="mt-3 text-3xl font-extrabold tracking-tight">Локализация · {target.label}</h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-on-surface-variant">
            Не переводим дословно. Сохраняем смысл и действие, затем переписываем текст естественно для выбранного рынка.
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            {['Естественность', 'Ясность', 'Конкретика', 'Контекст'].map((item) => (
              <span key={item} className="rounded-full bg-primary-container px-3 py-1.5 text-xs font-bold text-on-primary-container">{item}</span>
            ))}
          </div>
        </section>

        <div className="grid gap-6 xl:grid-cols-2">
          <section className="m3-card p-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="aug-field">
                <span>Исходный язык</span>
                <select value={sourceLanguage} onChange={(e) => setSourceLanguage(e.target.value)}>
                  <option value="auto">Определить автоматически</option>
                  <option value="en">Английский</option>
                  <option value="es">Испанский</option>
                  <option value="ru">Русский</option>
                  <option value="other">Другой</option>
                </select>
              </label>
              <label className="aug-field">
                <span>Контекст</span>
                <select value={contextType} onChange={(e) => setContextType(e.target.value as ContextType)}>
                  <option value="promo">Промо и лендинг</option>
                  <option value="ui">Интерфейс</option>
                  <option value="help">Справка</option>
                  <option value="pricing">Тарифы</option>
                  <option value="legal">Юридический текст</option>
                </select>
              </label>
              <label className="aug-field">
                <span>Бренд</span>
                <select value={brandId} onChange={(e) => setBrandId(e.target.value)}>
                  <option value="">Без бренда</option>
                  {brands.map((brand) => <option key={brand.id} value={brand.id}>{brand.brand_name}</option>)}
                </select>
              </label>
              <label className="aug-field">
                <span>Профиль локализации</span>
                <select value={templateId} onChange={(e) => setTemplateId(e.target.value)}>
                  {templates.map((template) => <option key={template.id} value={template.id}>{template.name}</option>)}
                </select>
              </label>
            </div>
            <label className="aug-field mt-5">
              <span>Исходный текст</span>
              <textarea
                value={sourceText}
                onChange={(e) => setSourceText(e.target.value)}
                rows={18}
                placeholder="Вставьте исходный текст без предварительного перевода…"
              />
              <small>{sourceText.length.toLocaleString('ru-RU')} / 40 000 знаков</small>
            </label>
            <button
              type="button"
              className="aug-button aug-button--primary mt-5"
              onClick={localize}
              disabled={loading || !sourceText.trim()}
              aria-busy={loading}
            >
              {loading ? 'Локализую…' : `Локализовать · ${target.locale}`}
            </button>
          </section>

          <section className="m3-card flex min-h-[560px] flex-col p-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <span className="aug-eyebrow">Результат</span>
                <h2 className="mt-2 text-xl font-bold">{target.label}</h2>
              </div>
              <button type="button" className="aug-button aug-button--secondary" onClick={copy} disabled={!output}>Копировать</button>
            </div>
            {model ? <p className="mt-2 text-xs text-on-surface-variant">Модель: {model}</p> : null}
            <div className="mt-5 flex-1 whitespace-pre-wrap rounded-[20px] bg-surface-container-low p-5 text-sm leading-7">
              {output || 'Здесь появится локализованный текст. Amado вернёт только готовый вариант без объяснений.'}
            </div>
          </section>
        </div>
      </div>
    </Layout>
  )
}
