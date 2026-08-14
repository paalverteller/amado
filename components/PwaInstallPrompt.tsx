/* eslint-disable @next/next/no-img-element */
'use client'

import { useEffect, useState } from 'react'

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
}

const DISMISS_UNTIL_KEY = 'amado-pwa-install-dismiss-until-v4'
const PROMPT_SEEN_KEY = 'amado-pwa-install-seen-v4'
const LEGACY_DISMISS_KEY = 'kupala-pwa-install-dismiss-until-v2'
const DISMISS_DAYS = 30

function isStandaloneMode(): boolean {
  if (typeof window === 'undefined') return false
  const nav = window.navigator as Navigator & { standalone?: boolean }
  return window.matchMedia('(display-mode: standalone)').matches || nav.standalone === true
}

function isMobileDevice(): boolean {
  if (typeof window === 'undefined') return false
  return window.matchMedia('(max-width: 780px)').matches || /android|iphone|ipad|ipod/i.test(window.navigator.userAgent)
}

function isIosDevice(): boolean {
  if (typeof window === 'undefined') return false
  return /iphone|ipad|ipod/i.test(window.navigator.userAgent)
}

function dismissalTimestamp(): number {
  if (typeof window === 'undefined') return Number.POSITIVE_INFINITY
  const current = Number(window.localStorage.getItem(DISMISS_UNTIL_KEY))
  const legacy = Number(window.localStorage.getItem(LEGACY_DISMISS_KEY))
  const safeCurrent = Number.isFinite(current) ? current : 0
  const safeLegacy = Number.isFinite(legacy) ? legacy : 0
  return Math.max(safeCurrent, safeLegacy)
}

function isDismissedNow(): boolean {
  return Date.now() < dismissalTimestamp()
}

function dismissFor(days = DISMISS_DAYS): void {
  const until = Date.now() + days * 24 * 60 * 60 * 1000
  window.localStorage.setItem(DISMISS_UNTIL_KEY, String(until))
}

export default function PwaInstallPrompt() {
  const [visible, setVisible] = useState(false)
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [showHelp, setShowHelp] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!isMobileDevice() || isStandaloneMode() || isDismissedNow()) return

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').then((registration) => {
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing
          if (!newWorker) return
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              newWorker.postMessage('SKIP_WAITING')
            }
          })
        })
        registration.update().catch(() => {})
      }).catch((error: unknown) => {
        console.error('[pwa] service worker registration failed', error)
      })

      let refreshing = false
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (refreshing) return
        refreshing = true
        window.location.reload()
      })
    }

    function handleBeforeInstallPrompt(event: Event) {
      event.preventDefault()
      setDeferredPrompt(event as BeforeInstallPromptEvent)
      if (!isDismissedNow() && !isStandaloneMode()) setVisible(true)
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)

    let iosTimer: number | undefined
    if (isIosDevice() && !window.localStorage.getItem(PROMPT_SEEN_KEY)) {
      iosTimer = window.setTimeout(() => {
        if (!isDismissedNow() && !isStandaloneMode()) {
          window.localStorage.setItem(PROMPT_SEEN_KEY, '1')
          setShowHelp(true)
          setVisible(true)
        }
      }, 1800)
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
      if (iosTimer) window.clearTimeout(iosTimer)
    }
  }, [])

  function close(days = DISMISS_DAYS) {
    dismissFor(days)
    setVisible(false)
    setShowHelp(false)
  }

  async function handleInstall() {
    if (deferredPrompt) {
      try {
        await deferredPrompt.prompt()
        const choice = await deferredPrompt.userChoice
        setDeferredPrompt(null)
        close(choice.outcome === 'accepted' ? 365 : 14)
      } catch (error) {
        console.error('[pwa] install prompt failed', error)
        setShowHelp(true)
      }
      return
    }
    setShowHelp(true)
  }

  if (!visible || isStandaloneMode() || isDismissedNow()) return null

  return (
    <aside className="aug-pwa-prompt" role="dialog" aria-modal="false" aria-labelledby="pwa-install-title" aria-live="polite">
      <div className="aug-pwa-prompt__row">
        <img className="aug-pwa-prompt__icon" src="/amado-icon.svg" alt="" />
        <div>
          <span className="aug-eyebrow">Amado PWA</span>
          <h2 id="pwa-install-title">Добавить Amado на экран</h2>
          <p>Быстрый доступ к обзору, рынку и созданию контента без лишней вкладки браузера.</p>

          {showHelp ? (
            <p className="aug-pwa-prompt__help">
              iPhone: Safari → «Поделиться» → «На экран Домой». Android: меню браузера → «Установить приложение» или «Добавить на главный экран».
            </p>
          ) : null}

          <div className="aug-pwa-prompt__actions">
            <button type="button" onClick={handleInstall} className="aug-button aug-button--primary">
              {deferredPrompt ? 'Установить' : 'Как установить'}
            </button>
            <button type="button" onClick={() => close(30)} className="aug-button aug-button--secondary">
              Позже
            </button>
          </div>
        </div>
      </div>
    </aside>
  )
}
