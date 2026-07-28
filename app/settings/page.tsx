/* eslint-disable react-hooks/set-state-in-effect */
'use client'

import { useState, useEffect } from 'react'
import Layout from '@/components/Layout'
import TemplateCard from '@/components/settings/TemplateCard'
import SourceCard from '@/components/settings/SourceCard'
import { PromptTemplate, RssSource, BrandProfile } from '@/lib/supabase'
import { t } from '@/lib/i18n/config'

export default function SettingsPage() {
  const [templates, setTemplates] = useState<PromptTemplate[]>([])
  const [sources, setSources] = useState<RssSource[]>([])
  const [brandProfiles, setBrandProfiles] = useState<BrandProfile[]>([])
  const [regions, setRegions] = useState<{ id: string; code: string; name: string }[]>([])
  
  const [newSourceName, setNewSourceName] = useState('')
  const [newSourceUrl, setNewSourceUrl] = useState('')
  const [newSourceType, setNewSourceType] = useState('rss')

  const [newBrandName, setNewBrandName] = useState('')
  const [newBrandVoice, setNewBrandVoice] = useState('')
  const [newBrandForbidden, setNewBrandForbidden] = useState('')
  const [newBrandExamples, setNewBrandExamples] = useState('')
  const [newBrandAudience, setNewBrandAudience] = useState('')
  const [newBrandCompetitors, setNewBrandCompetitors] = useState('')
  const [newBrandPositioning, setNewBrandPositioning] = useState('')
  const [newBrandThemes, setNewBrandThemes] = useState('')
  const [newBrandFacts, setNewBrandFacts] = useState('')
  const [newBrandSensitive, setNewBrandSensitive] = useState('')
  const [newBrandRegion, setNewBrandRegion] = useState('')

  const reloadData = () => {
    fetch('/api/templates').then(res => res.json()).then(data => setTemplates(data.templates || []))
    fetch('/api/rss').then(res => res.json()).then(data => setSources(data.sources || []))
    fetch('/api/brand-profiles').then(res => res.json()).then(data => setBrandProfiles(data.profiles || []))
    fetch('/api/regions').then(res => res.json()).then(data => setRegions(data.regions || []))
  }

  useEffect(() => reloadData(), [])

  const handleAddSource = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newSourceName.trim() || !newSourceUrl.trim()) return

    await fetch('/api/rss', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: newSourceName,
        url: newSourceUrl,
        source_type: newSourceType,
        country: 'Brasil',
      }),
    })

    setNewSourceName('')
    setNewSourceUrl('')
    setNewSourceType('rss')
    reloadData()
  }

  const handleAddBrandProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newBrandName.trim() || !newBrandVoice.trim()) return

    await fetch('/api/brand-profiles', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        brand_name: newBrandName,
        voice_description: newBrandVoice,
        forbidden_words: newBrandForbidden,
        example_posts: newBrandExamples,
        target_audience: newBrandAudience,
        competitors: newBrandCompetitors,
        positioning: newBrandPositioning,
        strategic_themes: newBrandThemes,
        product_facts: newBrandFacts,
        sensitive_topics: newBrandSensitive,
        region_id: newBrandRegion || undefined,
      }),
    })

    setNewBrandName('')
    setNewBrandVoice('')
    setNewBrandForbidden('')
    setNewBrandExamples('')
    setNewBrandAudience('')
    setNewBrandCompetitors('')
    setNewBrandPositioning('')
    setNewBrandThemes('')
    setNewBrandFacts('')
    setNewBrandSensitive('')
    setNewBrandRegion('')
    reloadData()
  }

  const handleDeleteBrandProfile = async (id: string) => {
    await fetch(`/api/brand-profiles?id=${id}`, { method: 'DELETE' })
    reloadData()
  }

  const handleToggleBrandProfile = async (id: string, current: boolean) => {
    await fetch('/api/brand-profiles', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, is_active: !current }),
    })
    reloadData()
  }

  return (
    <Layout>
      <div className="space-y-10">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-on-background">{t('settings.title')}</h1>
          <p className="text-sm text-on-surface-variant mt-1">{t('settings.subtitle')}</p>
        </div>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-on-surface">{t('settings.sources')}</h2>
          
          <form onSubmit={handleAddSource} className="m3-card flex flex-col sm:flex-row gap-3 p-4 items-center">
            <input
              value={newSourceName}
              onChange={(e) => setNewSourceName(e.target.value)}
              placeholder={t('settings.source_name')}
              className="flex-1 rounded-xl bg-surface-container px-4 py-2 text-sm outline-none w-full"
              required
            />
            <input
              value={newSourceUrl}
              onChange={(e) => setNewSourceUrl(e.target.value)}
              placeholder={t('settings.source_url')}
              className="flex-1 rounded-xl bg-surface-container px-4 py-2 text-sm outline-none w-full"
              required
            />
            <select
              value={newSourceType}
              onChange={(e) => setNewSourceType(e.target.value)}
              className="rounded-xl bg-surface-container px-4 py-2 text-sm outline-none"
            >
              <option value="rss">RSS</option>
              <option value="atom">Atom</option>
              <option value="html_index">HTML</option>
              <option value="api">API</option>
              <option value="manual">{t('settings.manual')}</option>
            </select>
            <button type="submit" className="m3-button-filled w-full sm:w-auto shrink-0 py-2">
              + {t('action.add')}
            </button>
          </form>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {sources.map(s => (
              <SourceCard 
                key={s.id} source={s} 
                onToggleActive={async (id, a) => {
                  await fetch(`/api/rss/${id}`, { method: 'PATCH', body: JSON.stringify({ active: !a }) })
                  reloadData()
                }} 
                onDelete={async (id) => {
                  await fetch(`/api/rss/${id}`, { method: 'DELETE' })
                  reloadData()
                }} 
              />
            ))}
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-on-surface">{t('settings.templates')}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {templates.map(t => (
              <TemplateCard 
                key={t.id} template={t} 
                onToggleActive={async (id, a) => {
                  await fetch(`/api/templates`, { method: 'PATCH', body: JSON.stringify({ id, is_active: !a }) })
                  reloadData()
                }} 
              />
            ))}
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-on-surface">{t('settings.brands')}</h2>
          
          <form onSubmit={handleAddBrandProfile} className="m3-card p-4 space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <input
                value={newBrandName}
                onChange={(e) => setNewBrandName(e.target.value)}
                placeholder={`${t('settings.brand_name')} *`}
                className="rounded-xl bg-surface-container px-4 py-2 text-sm outline-none w-full"
                required
              />
              <select
                value={newBrandRegion}
                onChange={(e) => setNewBrandRegion(e.target.value)}
                className="rounded-xl bg-surface-container px-4 py-2 text-sm outline-none w-full"
              >
                <option value="">{t('settings.regions')}...</option>
                {regions.map(r => (
                  <option key={r.id} value={r.id}>{r.name}</option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <input
                value={newBrandAudience}
                onChange={(e) => setNewBrandAudience(e.target.value)}
                placeholder={t('settings.brand_audience')}
                className="rounded-xl bg-surface-container px-4 py-2 text-sm outline-none w-full"
              />
              <input
                value={newBrandCompetitors}
                onChange={(e) => setNewBrandCompetitors(e.target.value)}
                placeholder={t('settings.brand_competitors')}
                className="rounded-xl bg-surface-container px-4 py-2 text-sm outline-none w-full"
              />
            </div>
            <textarea
              value={newBrandVoice}
              onChange={(e) => setNewBrandVoice(e.target.value)}
              placeholder={`${t('settings.brand_voice')} *`}
              rows={3}
              className="rounded-xl bg-surface-container px-4 py-2 text-sm outline-none w-full resize-none"
              required
            />
            <textarea
              value={newBrandPositioning}
              onChange={(e) => setNewBrandPositioning(e.target.value)}
              placeholder="Posicionamento da marca"
              rows={2}
              className="rounded-xl bg-surface-container px-4 py-2 text-sm outline-none w-full resize-none"
            />
            <textarea
              value={newBrandThemes}
              onChange={(e) => setNewBrandThemes(e.target.value)}
              placeholder="Temas estratégicos (separados por vírgula)"
              rows={2}
              className="rounded-xl bg-surface-container px-4 py-2 text-sm outline-none w-full resize-none"
            />
            <textarea
              value={newBrandFacts}
              onChange={(e) => setNewBrandFacts(e.target.value)}
              placeholder="Fatos do produto (claims aprovados)"
              rows={2}
              className="rounded-xl bg-surface-container px-4 py-2 text-sm outline-none w-full resize-none"
            />
            <textarea
              value={newBrandForbidden}
              onChange={(e) => setNewBrandForbidden(e.target.value)}
              placeholder={t('settings.brand_forbidden')}
              rows={2}
              className="rounded-xl bg-surface-container px-4 py-2 text-sm outline-none w-full resize-none"
            />
            <textarea
              value={newBrandExamples}
              onChange={(e) => setNewBrandExamples(e.target.value)}
              placeholder={t('settings.brand_examples')}
              rows={3}
              className="rounded-xl bg-surface-container px-4 py-2 text-sm outline-none w-full resize-none"
            />
            <textarea
              value={newBrandSensitive}
              onChange={(e) => setNewBrandSensitive(e.target.value)}
              placeholder="Tópicos sensíveis (requerem revisão humana)"
              rows={2}
              className="rounded-xl bg-surface-container px-4 py-2 text-sm outline-none w-full resize-none"
            />
            <button type="submit" className="m3-button-filled w-full sm:w-auto py-2">
              + {t('settings.add_brand')}
            </button>
          </form>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {brandProfiles.map(p => (
              <div key={p.id} className="m3-card p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-on-surface">{p.brand_name}</h3>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleToggleBrandProfile(p.id, p.is_active)}
                      className={`text-xs px-2 py-1 rounded-full border-none cursor-pointer ${p.is_active ? 'bg-primary text-on-primary' : 'bg-surface-variant text-on-surface-variant'}`}
                    >
                      {p.is_active ? t('status.active') : t('status.inactive')}
                    </button>
                    <button
                      onClick={() => handleDeleteBrandProfile(p.id)}
                      className="text-xs px-2 py-1 rounded-full bg-error-container text-on-error-container border-none cursor-pointer"
                    >
                      {t('action.delete')}
                    </button>
                  </div>
                </div>
                <p className="text-sm text-on-surface-variant line-clamp-2">{p.voice_description}</p>
                {p.target_audience && (
                  <p className="text-xs text-on-surface-variant/70">{t('settings.brand_audience')}: {p.target_audience}</p>
                )}
                {p.strategic_themes && (
                  <p className="text-xs text-primary/70">Temas: {p.strategic_themes}</p>
                )}
                {p.forbidden_words && (
                  <p className="text-xs text-error/70">{t('settings.brand_forbidden')}: {p.forbidden_words}</p>
                )}
              </div>
            ))}
          </div>
        </section>

      </div>
    </Layout>
  )
}
