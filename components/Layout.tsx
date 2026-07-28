/* eslint-disable @next/next/no-img-element */
'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { type ReactNode, useState, useEffect, useRef } from 'react'

// Desktop nav — all 6 items
const NAV_DESKTOP = [
  { href: '/generate', label: 'Geração' },
  { href: '/ideas',    label: 'Local Pulse' },
  { href: '/rewrite',  label: 'Rewrite' },
  { href: '/market',   label: 'Mercado' },
  { href: '/history',  label: 'Histórico' },
  { href: '/settings', label: 'Configurações' },
]

// Mobile bottom nav — 6 icon-only destinations split around center FAB
const NAV_MOBILE = [
  { href: '/generate', label: 'Criar',  icon: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 5v14M5 12h14"/>
    </svg>
  )},
  { href: '/market',   label: 'Mercado',    icon: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 12h20M2 6h20M2 18h12"/>
    </svg>
  )},
  { href: '/ideas',    label: 'Pulse',     icon: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9.663 17h4.673M12 3a6 6 0 0 1 6 6c0 2.29-1.22 4.3-3 5.42V16a1 1 0 0 1-1 1h-4a1 1 0 0 1-1-1v-1.58A6 6 0 0 1 12 3z"/>
    </svg>
  )},
  { href: '/rewrite',  label: 'Rewrite',  icon: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 20h9M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
    </svg>
  )},
  { href: '/history',  label: 'Histórico',  icon: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 8v4l3 3M3.05 11a9 9 0 1 0 .5-3M3 4v4h4"/>
    </svg>
  )},
  { href: '/settings', label: 'Mais',      icon: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M4.93 4.93a10 10 0 0 0 0 14.14"/>
    </svg>
  )},
]

function Brand() {
  return (
    <Link href="/generate" className="min-w-0 no-underline group flex items-center gap-3">
      <div
        className="shrink-0 flex items-center justify-center overflow-hidden"
        style={{
          width: 38,
          height: 38,
          borderRadius: 12,
          background: 'linear-gradient(135deg, #4A6FD4 0%, #2D55B0 100%)',
          boxShadow: '0 2px 8px rgba(74,111,212,0.35)',
          transition: 'transform 200ms ease, box-shadow 200ms ease',
        }}
      >
        <img src="/icon-nobg.svg" alt="Amado" style={{ width: '78%', height: '78%', objectFit: 'contain' }} />
      </div>
      <div className="flex flex-col min-w-0">
        <span
          className="truncate font-bold tracking-tight text-white"
          style={{ fontFamily: 'var(--font-display)', fontSize: 17, lineHeight: 1.2 }}
        >
          Amado
        </span>
        <span
          className="truncate font-semibold uppercase"
          style={{ fontSize: 9, letterSpacing: '0.14em', color: 'rgba(255,255,255,0.55)', lineHeight: 1.6 }}
        >
          Content Pipeline
        </span>
      </div>
    </Link>
  )
}

function QuickCreateModal({ onClose }: { onClose: () => void }) {
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()

  async function handleCreate() {
    if (text.trim().length < 20) {
      setError('Escreva um pouco mais — pelo menos duas frases')
      return
    }
    setError('')
    setLoading(true)
    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic: text.trim(), contentType: 'quick_note' }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error ?? 'Não foi possível criar o material')
      onClose()
      router.push('/history')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro desconhecido')
      setLoading(false)
    }
  }

  return (
    <div className="quick-create-overlay" onClick={onClose}>
      <div className="quick-create-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3
            className="m-0 font-bold text-lg"
            style={{ fontFamily: 'var(--font-display)', color: 'var(--color-on-surface)' }}
          >
            Conteúdo rápido
          </h3>
          <button
            onClick={onClose}
            style={{
              width: 32, height: 32, borderRadius: '50%',
              background: 'var(--color-surface-container-high)',
              border: 'none', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'var(--color-on-surface-variant)',
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="M18 6 6 18M6 6l12 12"/>
            </svg>
          </button>
        </div>

        <textarea
          autoFocus
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Escreva sua ideia como está — nós transformamos em conteúdo pronto..."
          rows={6}
          className="m3-input-outlined w-full"
          style={{ resize: 'none', fontSize: 15, lineHeight: 1.6 }}
        />

        {error && (
          <p className="text-sm font-medium mt-2 mb-0" style={{ color: 'var(--color-error)' }}>
            {error}
          </p>
        )}

        <button
          onClick={handleCreate}
          disabled={loading || text.trim().length < 20}
          className="m3-button-filled w-full h-12 mt-4 text-base disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {loading ? 'Criando conteúdo...' : 'Criar conteúdo'}
        </button>
      </div>
    </div>
  )
}

export default function Layout({ children }: { children: ReactNode }) {
  const pathname  = usePathname()
  const router    = useRouter()
  const [navVisible, setNavVisible] = useState(true)
  const lastScrollY = useRef(0)
  const [quickCreateOpen, setQuickCreateOpen] = useState(false)

  useEffect(() => {
    const onScroll = () => {
      const y = window.scrollY
      const dir = y - lastScrollY.current
      if (y < 10) setNavVisible(true)
      else if (dir > 4) setNavVisible(false)
      else if (dir < -4) setNavVisible(true)
      lastScrollY.current = y
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  // Add bottom-nav padding class to body for PWA
  useEffect(() => {
    document.body.classList.add('has-bottom-nav')
    return () => document.body.classList.remove('has-bottom-nav')
  }, [])

  async function handleLogout() {
    await fetch('/api/auth', { method: 'DELETE' })
    router.push('/')
  }

  function isActive(href: string) {
    return href === '/generate'
      ? pathname === href
      : pathname === href || pathname.startsWith(href + '/')
  }

  return (
    <div className="min-h-dvh font-sans flex flex-col" style={{ background: 'var(--color-background)', color: 'var(--color-on-background)' }}>

      {/* ── Premium Glassmorphic Header ── */}
      <header
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 40,
          width: '100%',
          height: 56,
          display: 'flex',
          alignItems: 'center',
          willChange: 'transform',
          transform: navVisible ? 'translateY(0)' : 'translateY(-100%)',
          transition: 'transform 280ms cubic-bezier(0.4,0,0.2,1)',
          background:
            
              'linear-gradient(135deg, #1E3A8A 0%, #2D55B0 60%, #4A6FD4 100%)',
          backdropFilter: 'none',
          WebkitBackdropFilter: 'none',
          borderBottom: '1px solid rgba(255,255,255,0.08)',
          boxShadow: '0 2px 12px rgba(30,58,138,0.25)',
        }}
      >
        {/* Accent gradient line at very top */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: 2,
            background: 'linear-gradient(90deg, #F97316 0%, #4A6FD4 50%, #7C3AED 100%)',
            opacity: 1,
            transition: 'opacity 300ms ease',
          }}
        />

        <div
          style={{
            margin: '0 auto',
            maxWidth: '1200px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 1rem',
            gap: '1.5rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '2rem' }}>
            <Brand />

            {/* Desktop Nav — hidden on mobile */}
            <nav className="hidden lg:flex" style={{ alignItems: 'center', gap: '0.25rem' }}>
              {NAV_DESKTOP.map(({ href, label }) => {
                const active = isActive(href)
                return (
                  <Link
                    key={href} href={href}
                    style={{
                      padding: '0.4rem 1rem',
                      borderRadius: 999,
                      fontSize: 13.5,
                      fontWeight: 600,
                      textDecoration: 'none',
                      letterSpacing: '0.01em',
                      transition: 'all 180ms ease',
                      background: active ? 'rgba(255,255,255,0.16)' : 'transparent',
                      color: active ? '#ffffff' : 'rgba(255,255,255,0.65)',
                      boxShadow: active ? 'inset 0 1px 0 rgba(255,255,255,0.12)' : 'none',
                    }}
                    onMouseEnter={e => {
                      if (!active) (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.10)'
                    }}
                    onMouseLeave={e => {
                      if (!active) (e.currentTarget as HTMLElement).style.background = 'transparent'
                    }}
                  >
                    {label}
                  </Link>
                )
              })}
            </nav>
          </div>

          {/* Logout */}
          <button
            onClick={handleLogout}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.375rem',
              padding: '0.4rem 1rem',
              borderRadius: 999,
              fontSize: 13,
              fontWeight: 600,
              border: '1px solid rgba(255,255,255,0.18)',
              background: 'rgba(255,255,255,0.08)',
              color: 'rgba(255,255,255,0.70)',
              cursor: 'pointer',
              transition: 'all 180ms ease',
              letterSpacing: '0.01em',
            }}
            onMouseEnter={e => {
              const el = e.currentTarget as HTMLElement
              el.style.background = 'rgba(220,38,38,0.20)'
              el.style.borderColor = 'rgba(220,38,38,0.40)'
              el.style.color = '#FCA5A5'
            }}
            onMouseLeave={e => {
              const el = e.currentTarget as HTMLElement
              el.style.background = 'rgba(255,255,255,0.08)'
              el.style.borderColor = 'rgba(255,255,255,0.18)'
              el.style.color = 'rgba(255,255,255,0.70)'
            }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
              <polyline points="16 17 21 12 16 7"/>
              <line x1="21" y1="12" x2="9" y2="12"/>
            </svg>
            <span className="hidden sm:inline">Sair</span>
          </button>
        </div>
      </header>

      {/* ── Main Content ── */}
      <main
        style={{
          flex: 1,
          width: '100%',
          maxWidth: 1200,
          margin: '0 auto',
          padding: '1.5rem 1rem 2rem',
        }}
        className="sm:px-6 sm:py-10"
      >
        <div className="animate-fade-in">
          {children}
        </div>
      </main>

      {/* ── Mobile Bottom Nav Bar (PWA-native, hidden on desktop) ── */}
      <nav className="bottom-nav lg:hidden" aria-label="Navegação principal">
        <div className="bottom-nav-inner">
          {NAV_MOBILE.slice(0, 3).map(({ href, label, icon }) => {
            const active = isActive(href)
            return (
              <Link
                key={href}
                href={href}
                aria-label={label}
                title={label}
                className={`bottom-nav-item${active ? ' active' : ''}`}
              >
                {icon}
              </Link>
            )
          })}

          <button
            type="button"
            className="bottom-nav-fab"
            aria-label="Conteúdo rápido"
            title="Conteúdo rápido"
            onClick={() => setQuickCreateOpen(true)}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 5v14M5 12h14"/>
            </svg>
          </button>

          {NAV_MOBILE.slice(3, 6).map(({ href, label, icon }) => {
            const active = isActive(href)
            return (
              <Link
                key={href}
                href={href}
                aria-label={label}
                title={label}
                className={`bottom-nav-item${active ? ' active' : ''}`}
              >
                {icon}
              </Link>
            )
          })}
        </div>
      </nav>

      {quickCreateOpen && <QuickCreateModal onClose={() => setQuickCreateOpen(false)} />}
    </div>
  )
}
