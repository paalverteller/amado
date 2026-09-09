'use client'

import { useEffect, useRef, useState } from 'react'
import { useMarket, MARKET_FLAGS } from '@/lib/market-context'

const MARKET_NAMES_RU: Record<string, string> = {
  BR: 'Бразилия',
  ES: 'Испания',
  DE: 'Германия',
  US: 'США',
  GB: 'Великобритания',
  MX: 'Мексика',
  IT: 'Италия',
}

function marketName(code?: string | null, fallback?: string): string {
  if (!code) return fallback || 'Рынок'
  return MARKET_NAMES_RU[code] ?? fallback ?? code
}

export default function MarketSwitcher({ compact = false }: { compact?: boolean }) {
  const { marketCode, regions, currentRegion, ready, loading, error, setMarketCode } = useMarket()
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function onClickOutside(event: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false)
    }
    function onEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    document.addEventListener('keydown', onEscape)
    return () => {
      document.removeEventListener('mousedown', onClickOutside)
      document.removeEventListener('keydown', onEscape)
    }
  }, [open])

  useEffect(() => {
    if (!ready) setOpen(false)
  }, [ready])

  const currentFlag = currentRegion ? (MARKET_FLAGS[currentRegion.code] ?? '🌐') : '🌐'
  const label = error ? 'Рынок недоступен' : loading ? 'Загрузка рынка…' : marketName(currentRegion?.code, currentRegion?.name)

  return (
    <div ref={rootRef} className="aug-market-switcher">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="aug-market-switcher__trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-busy={loading}
        aria-label={error ? `${label}: ${error}` : `Текущий рынок: ${label}`}
        disabled={!ready}
      >
        <span className="aug-market-switcher__flag" aria-hidden="true">{currentFlag}</span>
        {!compact && <span className="aug-market-switcher__label">{label}</span>}
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      {open && ready && (
        <div className="aug-market-switcher__menu" role="listbox" aria-label="Выберите рынок">
          {regions.map((region) => (
            <button
              key={region.id}
              type="button"
              role="option"
              aria-selected={region.code === marketCode}
              onClick={() => {
                setMarketCode(region.code)
                setOpen(false)
              }}
              className="aug-market-switcher__option"
              data-active={region.code === marketCode ? 'true' : undefined}
            >
              <span className="aug-market-switcher__flag" aria-hidden="true">{MARKET_FLAGS[region.code] ?? '🌐'}</span>
              <span>{marketName(region.code, region.name)}</span>
              {region.code === marketCode && (
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="ms-auto">
                  <path d="m5 12 5 5 9-9" />
                </svg>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
