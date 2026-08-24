'use client'

import { useCallback, useEffect, useState } from 'react'
import { fetchJson } from '@/lib/api-client'

interface Playbook {
  id: string
  platform: string
  locale: string
  version: string
  status: string
  strategy_json: Record<string, unknown> | null
  measurement_json: Record<string, unknown> | null
}

const PLATFORM_LABEL: Record<string, string> = {
  linkedin: 'LinkedIn',
  instagram: 'Instagram',
  facebook: 'Facebook',
  x: 'X',
  threads: 'Threads',
  youtube: 'YouTube',
  tiktok: 'TikTok',
  whatsapp: 'WhatsApp',
}

const LABELS: Record<string, string> = {
  purpose: 'Задача',
  cadence: 'Частота',
  working_length: 'Рабочая длина',
  format_rules: 'Формат',
  hashtag_rules: 'Хэштеги и теги',
  conversation_rules: 'Диалог',
  paid_rule: 'Продвижение',
  native_locale_rule: 'Локализация',
  cross_post_rule: 'Кросс-постинг',
  governance_rules: 'Общие правила',
  human_review: 'Проверка человеком',
  crisis_rule: 'Кризисный режим',
  ab_testing_rule: 'A/B-тесты',
  tone_rule: 'Тон',
  primary_kpis: 'Основные KPI',
  business_kpis: 'Бизнес-KPI',
  guardrails: 'Ограничения',
  north_star: 'Главный принцип',
  experiment_fields: 'Поля эксперимента',
}

function label(key: string): string {
  return LABELS[key] ?? key.replaceAll('_', ' ')
}

function Value({ value }: { value: unknown }) {
  if (value == null || value === '') return <span>—</span>

  if (Array.isArray(value)) {
    return (
      <ul className="m-0 list-disc space-y-1 pl-5">
        {value.map((item, index) => <li key={index}>{String(item)}</li>)}
      </ul>
    )
  }

  if (typeof value === 'object') {
    return (
      <pre className="m-0 whitespace-pre-wrap text-xs leading-5">
        {JSON.stringify(value, null, 2)}
      </pre>
    )
  }

  return <span>{String(value)}</span>
}

function Rules({
  title,
  data,
}: {
  title: string
  data: Record<string, unknown> | null
}) {
  const entries = Object.entries(data ?? {})
  if (entries.length === 0) return null

  return (
    <section className="space-y-3">
      <h4 className="m-0 text-sm font-bold text-on-surface">{title}</h4>
      {entries.map(([key, value]) => (
        <div key={key} className="rounded-xl border border-outline-variant/50 p-3">
          <div className="mb-1 text-xs font-semibold text-on-surface-variant">{label(key)}</div>
          <div className="text-sm leading-6 text-on-surface"><Value value={value} /></div>
        </div>
      ))}
    </section>
  )
}

export default function PlatformPlaybooksTab({ brandId }: { brandId: string }) {
  const [playbooks, setPlaybooks] = useState<Playbook[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState('all')

  const load = useCallback(async () => {
    if (!brandId) {
      setPlaybooks([])
      setLoading(false)
      return
    }

    setLoading(true)
    try {
      const data = await fetchJson<{ playbooks?: Playbook[] }>(`/api/brands/${brandId}/playbooks`)
      setPlaybooks(data?.playbooks ?? [])
    } finally {
      setLoading(false)
    }
  }, [brandId])

  useEffect(() => {
    void load()
  }, [load])

  const platforms = ['all', ...Array.from(new Set(playbooks.map((item) => item.platform)))]
  const visible = selected === 'all'
    ? playbooks
    : playbooks.filter((item) => item.platform === selected)

  if (!brandId) {
    return <div className="py-12 text-center text-on-surface-variant">Выберите бренд</div>
  }

  if (loading) {
    return <div className="py-12 text-center text-on-surface-variant">Загрузка…</div>
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="m-0 text-xl font-bold text-on-surface">Правила площадок</h3>
        <p className="mt-1 text-sm leading-6 text-on-surface-variant">
          Активные правила Brand OS автоматически добавляются в промпт при генерации контента для выбранной площадки.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {platforms.map((platform) => (
          <button
            key={platform}
            type="button"
            onClick={() => setSelected(platform)}
            className={selected === platform ? 'aug-button aug-button--primary' : 'aug-button aug-button--secondary'}
          >
            {platform === 'all' ? 'Все' : PLATFORM_LABEL[platform] ?? platform}
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <div className="rounded-2xl border border-outline-variant/50 bg-surface p-6 text-sm text-on-surface-variant">
          Для этого бренда нет активных правил площадок.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
          {visible.map((playbook) => (
            <article key={playbook.id} className="rounded-2xl border border-outline-variant/50 bg-surface p-5 shadow-sm">
              <header className="mb-5 flex items-start justify-between gap-3">
                <div>
                  <h3 className="m-0 text-lg font-bold text-on-surface">
                    {PLATFORM_LABEL[playbook.platform] ?? playbook.platform}
                  </h3>
                  <p className="m-0 mt-1 text-xs text-on-surface-variant">
                    {playbook.locale} · {playbook.version}
                  </p>
                </div>
                <span className="rounded-full bg-primary-container px-2.5 py-1 text-xs font-semibold text-on-primary-container">
                  Активно
                </span>
              </header>

              <div className="space-y-6">
                <Rules title="Стратегия" data={playbook.strategy_json} />
                <Rules title="Измерение" data={playbook.measurement_json} />
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  )
}
