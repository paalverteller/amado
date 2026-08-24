'use client'

/**
 * Amado — Sprint 12 Phase 2: selected-market client state.
 *
 * This is deliberately separate from lib/i18n/config.ts's Locale/t()
 * system. That system controls the UI language (ru/pt-BR/en labels).
 * This module controls which *market/region* the workspace is scoped to
 * (Brazil, Spain, ...) -- an independent axis. Do not merge them: the
 * project convention (see HANDOFF.md) is UI language and content
 * market/language are never conflated.
 *
 * Storage: a plain cookie, not the unused `user_preferences` table.
 * Reasoning: there is no per-user session model in this app (single shared
 * ACCESS_PASSWORD, see proxy.ts) -- there is no user row to key a
 * `user_preferences` record against. A cookie is the honest fit for
 * "this browser's chosen market" today. If real per-user accounts ever
 * land, migrating this to `user_preferences` is a small, isolated change
 * (one function: getStoredMarket/setStoredMarket below).
 *
 * IMPORTANT — scope of this phase: this module only stores and broadcasts
 * the *selection*. It does not yet change generation, prompts, or any API
 * route's query filtering (that's Phase 3/4, see docs/AMADO_ROADMAP.md).
 */

import { createContext, useContext, useEffect, useState, useCallback } from 'react'

export type MarketRegion = {
  id: string
  code: string
  name: string
}

export const DEFAULT_MARKET_CODE = 'BR'

const COOKIE_NAME = 'amado_market'
const COOKIE_MAX_AGE_DAYS = 365

// Small hand-maintained map so the switcher can show a flag without a
// schema change. Extend when a new region is added in a later phase.
export const MARKET_FLAGS: Record<string, string> = {
  BR: '🇧🇷',
  ES: '🇪🇸',
  DE: '🇩🇪',
  MX: '🇲🇽',
  IT: '🇮🇹',
  US: '🇺🇸',
  GB: '🇬🇧',
}

export function getStoredMarketCode(): string {
  if (typeof document === 'undefined') return DEFAULT_MARKET_CODE
  const match = document.cookie.match(/(?:^|;\s*)amado_market=([^;]+)/)
  return match ? decodeURIComponent(match[1]) : DEFAULT_MARKET_CODE
}

export function setStoredMarketCode(code: string): void {
  if (typeof document === 'undefined') return
  const maxAge = COOKIE_MAX_AGE_DAYS * 24 * 60 * 60
  document.cookie = `${COOKIE_NAME}=${encodeURIComponent(code)}; path=/; max-age=${maxAge}; SameSite=Lax`
}

type MarketContextValue = {
  marketCode: string
  regions: MarketRegion[]
  loading: boolean
  setMarketCode: (code: string) => void
}

const MarketContext = createContext<MarketContextValue | null>(null)

/** Mount once near the app shell root. Fetches active regions from
 *  /api/regions and reads/writes the selection cookie. Falls back to a
 *  single-entry Brazil list if the fetch fails, so the switcher always
 *  renders something usable even offline. */
export function useMarketState(): MarketContextValue {
  const [marketCode, setMarketCodeState] = useState<string>(DEFAULT_MARKET_CODE)
  const [regions, setRegions] = useState<MarketRegion[]>([{ id: 'br-fallback', code: 'BR', name: 'Brasil' }])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setMarketCodeState(getStoredMarketCode())
  }, [])

  useEffect(() => {
    let cancelled = false
    fetch('/api/regions')
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error('failed'))))
      .then((data: { regions?: MarketRegion[] }) => {
        if (cancelled) return
        if (Array.isArray(data.regions) && data.regions.length > 0) {
          setRegions(data.regions)
        }
      })
      .catch(() => {
        // keep the Brazil-only fallback already in state
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const setMarketCode = useCallback((code: string) => {
    setMarketCodeState(code)
    setStoredMarketCode(code)
  }, [])

  return { marketCode, regions, loading, setMarketCode }
}

export function MarketProvider({ children }: { children: React.ReactNode }) {
  const value = useMarketState()
  return <MarketContext.Provider value={value}>{children}</MarketContext.Provider>
}

/** Read the current market selection from anywhere under MarketProvider.
 *  Throws in dev if used outside the provider, matching the project's
 *  existing pattern for scoped context hooks. */
export function useMarket(): MarketContextValue {
  const ctx = useContext(MarketContext)
  if (!ctx) throw new Error('useMarket must be used within MarketProvider')
  return ctx
}
