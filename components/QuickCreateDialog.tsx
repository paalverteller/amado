'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import AugustDialog from '@/components/ui/AugustDialog'
import { toast } from '@/components/ui/AugustFeedback'
import { useMarket } from '@/lib/market-context'

export default function QuickCreateDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { regions, marketCode } = useMarket()
  const currentRegionId = regions.find((region) => region.code === marketCode)?.id ?? null
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleCreate() {
    const value = text.trim()
    if (value.length < 20) {
      toast.warning('Добавьте хотя бы две фразы — так Amado лучше поймёт задачу.', 'Нужно немного больше контекста')
      return
    }

    setLoading(true)
    try {
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic: value, contentType: 'quick_note', regionId: currentRegionId || undefined }),
      })
      const data = await response.json().catch(() => ({})) as { error?: string }
      if (!response.ok) throw new Error(data.error ?? 'Не удалось создать материал')
      setText('')
      onClose()
      toast.success('Черновик создан и сохранён в истории.', 'Готово')
      router.push('/history')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Неизвестная ошибка', 'Не удалось создать материал')
    } finally {
      setLoading(false)
    }
  }

  return (
    <AugustDialog
      open={open}
      onClose={onClose}
      title="Быстрое создание"
      eyebrow="Создание"
      description="Зафиксируйте мысль как есть. Контекст бренда и правила генерации подключатся автоматически."
      footer={(
        <>
          <button type="button" className="aug-button aug-button--secondary" onClick={onClose}>Отмена</button>
          <button type="button" className="aug-button aug-button--primary" onClick={handleCreate} disabled={loading || text.trim().length < 20} aria-busy={loading}>
            {loading ? 'Создаю…' : 'Создать черновик'}
          </button>
        </>
      )}
    >
      <label className="aug-field">
        <span>Идея или задача</span>
        <textarea
          autoFocus
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder="Например: объяснить, почему CRM удобнее таблицы для контроля продаж в небольшой компании…"
          rows={7}
        />
        <small>{text.length} знаков · минимум 20</small>
      </label>
    </AugustDialog>
  )
}
