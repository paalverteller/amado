/* eslint-disable @next/next/no-img-element */
'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { type ReactNode, useEffect, useState } from 'react'
import { t } from '@/lib/i18n/config'
import AugustDialog from '@/components/ui/AugustDialog'
import { toast } from '@/components/ui/AugustFeedback'
import { MarketProvider } from '@/lib/market-context'
import MarketSwitcher from '@/components/MarketSwitcher'

type NavItem = {
  href: string
  label: string
  icon: IconName
}

type IconName =
  | 'overview'
  | 'market'
  | 'generate'
  | 'localize'
  | 'knowledge'
  | 'brand'
  | 'competitors'
  | 'ideas'
  | 'rewrite'
  | 'history'
  | 'settings'
  | 'more'
  | 'logout'

const NAV_PRIMARY: NavItem[] = [
  { href: '/overview', label: t('nav.overview'), icon: 'overview' },
  { href: '/market', label: t('nav.market'), icon: 'market' },
  { href: '/generate', label: t('nav.generate'), icon: 'generate' },
  { href: '/localize', label: 'Локализация', icon: 'localize' },
  { href: '/knowledge', label: t('nav.knowledge'), icon: 'knowledge' },
  { href: '/brand', label: t('nav.brand'), icon: 'brand' },
  { href: '/competitors', label: t('nav.competitors'), icon: 'competitors' },
]

const NAV_UTILITY: NavItem[] = [
  { href: '/ideas', label: t('nav.ideas'), icon: 'ideas' },
  { href: '/rewrite', label: t('nav.rewrite'), icon: 'rewrite' },
  { href: '/history', label: t('nav.history'), icon: 'history' },
  { href: '/settings', label: t('nav.settings'), icon: 'settings' },
]

const MOBILE_NAV: NavItem[] = [
  { href: '/overview', label: 'Обзор', icon: 'overview' },
  { href: '/market', label: 'Рынок', icon: 'market' },
  { href: '/generate', label: 'Создать', icon: 'generate' },
  { href: '/localize', label: 'Локализация', icon: 'localize' },
]

const MOBILE_MORE: NavItem[] = [
  { href: '/history', label: 'История', icon: 'history' },
  { href: '/knowledge', label: 'База знаний', icon: 'knowledge' },
  { href: '/brand', label: 'Бренд', icon: 'brand' },
  { href: '/competitors', label: 'Конкуренты', icon: 'competitors' },
  { href: '/ideas', label: 'Идеи', icon: 'ideas' },
  { href: '/rewrite', label: 'Rewrite', icon: 'rewrite' },
  { href: '/settings', label: 'Настройки', icon: 'settings' },
]

function NavIcon({ name }: { name: IconName }) {
  const common = {
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.9,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
  }

  if (name === 'overview') return <svg {...common}><rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><path d="M14 17h7m-3.5-3.5V21"/></svg>
  if (name === 'market') return <svg {...common}><path d="M4 19V9m6 10V5m6 14v-7m4 7H2"/><path d="m4 7 6-4 6 6 4-3"/></svg>
  if (name === 'generate') return <svg {...common}><path d="M12 3v18M3 12h18"/><path d="m17.5 4.5.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7.7-1.8Z"/></svg>
  if (name === 'localize') return <svg {...common}><path d="M4 5h8M8 3v2"/><path d="M5 9c2.8-.8 5-3 6-6M6 7c1.1 2 2.4 3.3 4.2 4.2"/><path d="M14 8h6m-3-3v12m-3-4h6"/></svg>
  if (name === 'knowledge') return <svg {...common}><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H11v16H6.5A2.5 2.5 0 0 0 4 21.5v-16Z"/><path d="M20 5.5A2.5 2.5 0 0 0 17.5 3H13v16h4.5a2.5 2.5 0 0 1 2.5 2.5v-16Z"/></svg>
  if (name === 'brand') return <svg {...common}><path d="M12 3 4.5 7v10L12 21l7.5-4V7L12 3Z"/><path d="m8.5 12 2.2 2.2 4.8-5"/></svg>
  if (name === 'competitors') return <svg {...common}><circle cx="8" cy="8" r="3"/><circle cx="16.5" cy="9.5" r="2.5"/><path d="M3 20c.5-4 2.5-6 5-6s4.5 2 5 6M13 15c1-.9 2.1-1.3 3.5-1.3 2.3 0 4 1.8 4.5 5.3"/></svg>
  if (name === 'ideas') return <svg {...common}><path d="M9 18h6m-5 3h4"/><path d="M8.2 15.2A7 7 0 1 1 15.8 15c-.8.6-1.3 1.2-1.5 2h-4.6c-.2-.7-.7-1.3-1.5-1.8Z"/></svg>
  if (name === 'rewrite') return <svg {...common}><path d="M4 20h5l10.5-10.5a2.8 2.8 0 0 0-4-4L5 16l-1 4Z"/><path d="m13.8 7.2 3 3"/></svg>
  if (name === 'history') return <svg {...common}><path d="M3.5 11a8.5 8.5 0 1 0 2-5.5L3 8"/><path d="M3 3v5h5M12 7v5l3 2"/></svg>
  if (name === 'settings') return <svg {...common}><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6V21h-4v-.1A1.7 1.7 0 0 0 9 19.4a1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 3 14H3v-4h.1A1.7 1.7 0 0 0 4.6 9a1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1A1.7 1.7 0 0 0 9 4.6 1.7 1.7 0 0 0 10 3V3h4v.1A1.7 1.7 0 0 0 15 4.6a1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.1v4H21a1.7 1.7 0 0 0-1.6 1Z"/></svg>
  if (name === 'logout') return <svg {...common}><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5M21 12H9"/></svg>
  return <svg {...common}><circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/></svg>
}

function BrandMark({ compact = false }: { compact?: boolean }) {
  return (
    <Link href="/overview" className="aug-brand" aria-label="Amado — на главную">
      <img src="/amado-icon.svg" alt="" className="aug-brand__mark" />
      {!compact ? (
        <span className="aug-brand__copy">
          <strong>amado</strong>
          <small>marketing intelligence</small>
        </span>
      ) : null}
    </Link>
  )
}

function QuickCreateDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
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
        body: JSON.stringify({ topic: value, contentType: 'quick_note' }),
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
      eyebrow="Amado Create"
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
          placeholder="Например: объяснить, почему CRM полезнее таблицы для follow-up в небольшой бразильской компании…"
          rows={7}
        />
        <small>{text.length} знаков · минимум 20</small>
      </label>
    </AugustDialog>
  )
}

export default function Layout({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const [quickCreateOpen, setQuickCreateOpen] = useState(false)
  const [moreOpen, setMoreOpen] = useState(false)

  useEffect(() => {
    document.body.classList.add('has-bottom-nav')
    return () => document.body.classList.remove('has-bottom-nav')
  }, [])

  async function handleLogout() {
    await fetch('/api/auth', { method: 'DELETE' })
    router.push('/')
  }

  function isActive(href: string) {
    if (href === '/overview' || href === '/generate') return pathname === href
    return pathname === href || pathname.startsWith(`${href}/`)
  }

  const moreIsActive = MOBILE_MORE.some((item) => isActive(item.href))

  return (
    <MarketProvider>
    <div className="aug-app-shell">
      <aside className="aug-sidebar" aria-label="Навигация Amado">
        <div className="aug-sidebar__brand">
          <BrandMark />
        </div>

        <div className="aug-sidebar__quick">
          <button type="button" className="aug-button aug-button--primary aug-button--full" onClick={() => setQuickCreateOpen(true)}>
            <NavIcon name="generate" />
            Быстро создать
          </button>
        </div>

        <nav className="aug-sidebar__nav" aria-label="Основные разделы">
          <span className="aug-nav-group-label">Рабочее пространство</span>
          {NAV_PRIMARY.map((item) => (
            <Link key={item.href} href={item.href} className="aug-nav-item" aria-current={isActive(item.href) ? 'page' : undefined}>
              <span className="aug-nav-item__icon"><NavIcon name={item.icon} /></span>
              <span>{item.label}</span>
            </Link>
          ))}

          <span className="aug-nav-group-label aug-nav-group-label--spaced">Инструменты</span>
          {NAV_UTILITY.map((item) => (
            <Link key={item.href} href={item.href} className="aug-nav-item aug-nav-item--utility" aria-current={isActive(item.href) ? 'page' : undefined}>
              <span className="aug-nav-item__icon"><NavIcon name={item.icon} /></span>
              <span>{item.label}</span>
            </Link>
          ))}
        </nav>

        <div className="aug-sidebar__footer">
          <div className="aug-growth-note">
            <span className="aug-growth-note__dot" />
            <div><strong>Amado</strong><small>Brazil · AI workspace</small></div>
          </div>
          <button type="button" className="aug-nav-item aug-nav-item--logout" onClick={handleLogout}>
            <span className="aug-nav-item__icon"><NavIcon name="logout" /></span>
            <span>Выйти</span>
          </button>
        </div>
      </aside>

      <div className="aug-workspace">
        <header className="aug-mobile-header">
          <BrandMark compact />
          <div className="flex items-center gap-2">
            <MarketSwitcher compact />
            <button type="button" className="aug-button aug-button--primary aug-mobile-header__create" onClick={() => setQuickCreateOpen(true)}>
              <NavIcon name="generate" />
              Создать
            </button>
          </div>
        </header>

        <div className="aug-topbar">
          <MarketSwitcher />
        </div>

        <main className="aug-workspace__main">
          <div className="aug-page-enter">{children}</div>
        </main>
      </div>

      <nav className="aug-mobile-nav" aria-label="Основная навигация">
        <div className="aug-mobile-nav__inner">
          {MOBILE_NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`aug-mobile-nav__item${item.href === '/generate' ? ' aug-mobile-nav__item--create' : ''}`}
              aria-current={isActive(item.href) ? 'page' : undefined}
              title={item.label}
            >
              <span><NavIcon name={item.icon} /></span>
              <small>{item.label}</small>
            </Link>
          ))}
          <button
            type="button"
            className="aug-mobile-nav__item"
            data-active={moreIsActive || moreOpen ? 'true' : undefined}
            onClick={() => setMoreOpen(true)}
            aria-expanded={moreOpen}
            aria-haspopup="dialog"
          >
            <span><NavIcon name="more" /></span>
            <small>Ещё</small>
          </button>
        </div>
      </nav>

      <AugustDialog
        open={moreOpen}
        onClose={() => setMoreOpen(false)}
        title="Все разделы"
        eyebrow="Навигация"
        description="Дополнительные рабочие пространства Amado."
        className="aug-dialog--mobile-sheet"
      >
        <div className="aug-more-grid">
          {MOBILE_MORE.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="aug-more-link"
              aria-current={isActive(item.href) ? 'page' : undefined}
              onClick={() => setMoreOpen(false)}
            >
              <span className="aug-more-link__icon"><NavIcon name={item.icon} /></span>
              <span>{item.label}</span>
            </Link>
          ))}
        </div>
      </AugustDialog>

      <QuickCreateDialog open={quickCreateOpen} onClose={() => setQuickCreateOpen(false)} />
    </div>
    </MarketProvider>
  )
}