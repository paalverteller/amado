'use client'

import { useState } from 'react'

interface TemplateCardProps {
  template: {
    id: string
    name: string
    tone_description: string
    usage_count: number
    version: string
    is_active: boolean
    is_default: boolean
  }
  onToggleActive: (id: string, currentStatus: boolean) => Promise<void>
}

export default function TemplateCard({ template, onToggleActive }: TemplateCardProps) {
  const [loading, setLoading] = useState(false)

  const handleToggle = async () => {
    setLoading(true)
    try {
      await onToggleActive(template.id, template.is_active)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="m3-card p-5 flex flex-col justify-between gap-4">
      <div>
        <div className="flex items-start justify-between gap-3 mb-2">
          <h4 className="font-semibold text-base text-on-surface flex items-center gap-2 m-0">
            {template.name}
            {template.is_default && (
              <span className="bg-primary-container text-on-primary-container text-[10px] uppercase px-2 py-0.5 rounded-full font-bold tracking-wider">
                Базовый
              </span>
            )}
          </h4>
          <span className="text-[10px] font-mono text-on-surface-variant bg-surface-container-high px-2 py-0.5 rounded-md border border-surface-variant">
            {template.version}
          </span>
        </div>
        <p className="text-sm text-on-surface-variant mt-2 leading-relaxed m-0">
          {template.tone_description || 'Описание не указано.'}
        </p>
      </div>

      <div className="pt-4 border-t border-surface-variant/50 flex items-center justify-between">
        <div className="text-xs font-medium text-on-surface-variant">
          Использован: <span className="font-bold text-on-surface">{template.usage_count || 0} раз</span>
        </div>
        <button
          onClick={handleToggle}
          disabled={loading}
          className={`m3-button-tonal text-xs py-1.5 px-3 shadow-none ${!template.is_active ? 'bg-primary-container text-on-primary-container hover:bg-primary-container/80' : 'bg-surface-variant text-on-surface-variant hover:bg-error-container hover:text-on-error-container'} ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          {loading ? '...' : (template.is_active ? 'Выключить' : 'Включить')}
        </button>
      </div>
    </div>
  )
}
