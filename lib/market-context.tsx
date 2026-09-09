'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'

export type MarketRegion = {
  id: string
  code: string
  name: string
}

export const DEFAULT_MARKET_CODE = 'BR'

const COOKIE_NAME = 'amado_market'
const COOKIE_MAX_AGE_DAYS = 365

export const MARKET_FLAGS: Record<string, string> = {
  BR: '🇧🇷',
  ES: '🇪🇸',
  DE: '🇩🇪',
  MX: '🇲🇽',
  IT: '🇮🇹',
  US: '🇺🇸',
  GB: '🇬🇧',
}

export function getStoredMarketCode(): string | null {
  if (typeof document === 'undefined') return null
  const match = document.cookie.match(/(?:^|;\s*)amado_market=([^;]+)/)
  return match ? decodeURIComponent(match[1]) : null
}

export function setStoredMarketCode(code: string): void {
  if (typeof document === 'undefined') return
  const maxAge = COOKIE_MAX_AGE_DAYS * 24 * 60 * 60
  document.cookie = `${COOKIE_NAME}=${encodeURIComponent(code)}; path=/; max-age=${maxAge}; SameSite=Lax`
}

export function resolveMarketCode(storedCode: string | null, regions: MarketRegion[]): string | null {
  if (regions.length === 0) return null
  if (storedCode && regions.some((region) => region.code === storedCode)) return storedCode
  if (regions.some((region) => region.code === DEFAULT_MARKET_CODE)) return DEFAULT_MARKET_CODE
  return regions[0].code
}

type MarketContextValue = {
  marketCode: string | null
  regions: MarketRegion[]
  currentRegion: MarketRegion | null
  loading: boolean
  ready: boolean
  error: string | null
  setMarketCode: (code: string) => void
}

const MarketContext = createContext<MarketContextValue | null>(null)

/**
 * Resolves the selected market before exposing a usable region to consumers.
 * Market-scoped screens must wait for `ready` instead of issuing an unfiltered
 * request during hydration. There is deliberately no fake Brazil UUID.
 */
export function useMarketState(): MarketContextValue {
  const [marketCode, setMarketCodeState] = useState<string | null>(null)
  const [regions, setRegions] = useState<MarketRegion[]>([])
  const [loading, setLoading] = useState(true)
  const [ready, setReady] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const controller = new AbortController()

    async function loadRegions() {
      setLoading(true)
      setReady(false)
      setError(null)

      try {
        const storedCode = getStoredMarketCode()
        const response = await fetch('/api/regions', { cache: 'no-store', signal: controller.signal })
        const data = await response.json().catch(() => ({})) as { regions?: MarketRegion[]; error?: string }
        if (!response.ok) throw new Error(data.error ?? 'Не удалось загрузить рынки')

        const activeRegions = Array.isArray(data.regions) ? data.regions : []
        if (activeRegions.length === 0) throw new Error('Нет доступных рынков')

        const resolvedCode = resolveMarketCode(storedCode, activeRegions)
        if (!resolvedCode) throw new Error('Не удалось определить рынок')

        setRegions(activeRegions)
        setMarketCodeState(resolvedCode)
        if (storedCode !== resolvedCode) setStoredMarketCode(resolvedCode)
        setReady(true)
      } catch (loadError) {
        if (controller.signal.aborted) return
        setRegions([])
        setMarketCodeState(null)
        setError(loadError instanceof Error ? loadError.message : 'Не удалось загрузить рынки')
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }

    void loadRegions()
    return () => controller.abort()
  }, [])

  const setMarketCode = useCallback((code: string) => {
    if (!regions.some((region) => region.code === code)) return
    setMarketCodeState(code)
    setStoredMarketCode(code)
  }, [regions])

  const currentRegion = useMemo(
    () => regions.find((region) => region.code === marketCode) ?? null,
    [marketCode, regions],
  )

  return useMemo(() => ({
    marketCode,
    regions,
    currentRegion,
    loading,
    ready,
    error,
    setMarketCode,
  }), [marketCode, regions, currentRegion, loading, ready, error, setMarketCode])
}

export function MarketProvider({ children }: { children: React.ReactNode }) {
  const value = useMarketState()
  return <MarketContext.Provider value={value}>{children}</MarketContext.Provider>
}

export function useMarket(): MarketContextValue {
  const ctx = useContext(MarketContext)
  if (!ctx) throw new Error('useMarket must be used within MarketProvider')
  return ctx
}
