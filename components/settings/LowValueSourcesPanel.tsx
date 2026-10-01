'use client'

import { useMemo, useState } from 'react'
import { confirmAction, toast } from '@/components/ui/AugustFeedback'
import { t } from '@/lib/i18n/config'
import type { SourceObservability } from '@/lib/domain/observability'

interface SourceLike {
  id: string
  name: string
  is_active?: boolean
  active?: boolean
}

interface LowValueSourcesPanelProps {
  sources: SourceLike[]
  observability: Record<string, SourceObservability>
  onDisable: (ids: string[]) => Promise<void>
}

// A source counts as low-value when it's turned on but produced zero
// evidence in the observability window. This is deliberately narrow: it
// only asks "did anything come in at all", not "was what came in good"
// (extraction/duplicate rates are a separate, quality-of-output concern
// that would make this threshold fuzzy and harder to trust at a glance).
function isLowValue(source: SourceLike, observability: SourceObservability | undefined): boolean {
  const isActive = source.is_active ?? source.active ?? true
  if (!isActive) return false
  if (!observability) return false
  return observability.yield.evidenceCount === 0
}

export default function LowValueSourcesPanel({ sources, observability, onDisable }: LowValueSourcesPanelProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [submitting, setSubmitting] = useState(false)

  const lowValueSources = useMemo(
    () => sources.filter((s) => isLowValue(s, observability[s.id])),
    [sources, observability],
  )

  if (lowValueSources.length === 0) return null

  const windowDays = observability[lowValueSources[0].id]?.yield.windowDays ?? 30

  // Filter out any selected id that's no longer in the current low-value
  // list (e.g. the source picked up evidence since the last fetch and
  // dropped off this list) rather than trusting `selected` as-is. Without
  // this, a stale id could sit in `selected` with no row left to
  // deselect it from, and "select all"'s checked state (compared by
  // .size below) could be wrong.
  const validSelected = new Set(Array.from(selected).filter((id) => lowValueSources.some((s) => s.id === id)))

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleAll() {
    setSelected(validSelected.size === lowValueSources.length ? new Set() : new Set(lowValueSources.map((s) => s.id)))
  }

  async function handleDisableSelected() {
    const ids = Array.from(validSelected)
    if (ids.length === 0) return
    const confirmed = await confirmAction({
      title: t('settings.low_value_disable_confirm_title'),
      message: `${t('settings.low_value_disable_confirm_message')} (${ids.length})`,
      confirmLabel: t('settings.low_value_disable_confirm_button'),
      danger: true,
    })
    if (!confirmed) return

    setSubmitting(true)
    try {
      await onDisable(ids)
      setSelected(new Set())
      toast.success(t('settings.low_value_disabled_toast'))
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('settings.low_value_disable_error'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="m3-card space-y-3 p-4" style={{ background: 'var(--aug-danger-bg)' }}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold" style={{ color: 'var(--aug-danger-fg)' }}>
            {t('settings.low_value_title')}
          </p>
          <p className="mt-1 text-xs text-on-surface-variant">
            {t('settings.low_value_subtitle')} ({windowDays} {t('settings.low_value_days')})
          </p>
        </div>
        <button
          type="button"
          onClick={handleDisableSelected}
          disabled={validSelected.size === 0 || submitting}
          className="rounded-full px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
          style={{ background: 'var(--aug-danger-fg)' }}
        >
          {t('settings.low_value_disable_button')} ({validSelected.size})
        </button>
      </div>

      <label className="flex items-center gap-2 text-xs text-on-surface-variant">
        <input
          type="checkbox"
          checked={validSelected.size === lowValueSources.length}
          onChange={toggleAll}
        />
        {t('settings.low_value_select_all')}
      </label>

      <ul className="space-y-1">
        {lowValueSources.map((source) => (
          <li key={source.id} className="flex items-center gap-2 text-sm text-on-surface">
            <input
              type="checkbox"
              checked={validSelected.has(source.id)}
              onChange={() => toggle(source.id)}
            />
            <span className="truncate">{source.name}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
