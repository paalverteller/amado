'use client'

import { useEffect, useRef, useState } from 'react'
import { useMarket, MARKET_FLAGS } from '@/lib/market-context'

/** Dropdown showing the active market (Brazil by default) with other active
 *  regions to switch to. Sprint 12 Phase 2: selection only, does not yet
 *  change prompts/content language/API filtering (see docs/AMADO_ROADMAP.md
 *  Sprint 12 Phase 3/4). */
export default function MarketSwitcher({ compact = false }: { compact?: boolean }) {
  const { marketCode, regions, setMarketCode } = useMarket()
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function onClickOutside(event: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false)
      }
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

  const current = regions.find((r) => r.code === marketCode) ?? regions[0]
  const currentFlag = current ? (MARKET_FLAGS[current.code] ?? '🌐') : '🌐'

  return (
    <div ref={rootRef} className="aug-market-switcher">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="aug-market-switcher__trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className="aug-market-switcher__flag" aria-hidden="true">{currentFlag}</span>
        {!compact && <span className="aug-market-switcher__label">{current?.name ?? 'Brasil'}</span>}
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      {open && (
        <div className="aug-market-switcher__menu" role="listbox">
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
              <span>{region.name}</span>
              {region.code === marketCode && (
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ marginInlineStart: 'auto' }}>
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
