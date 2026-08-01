/* eslint-disable @next/next/no-img-element */
'use client'

import { useEffect, useState } from 'react'

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
}

const DISMISS_UNTIL_KEY = 'kupala-pwa-install-dismiss-until-v2'
const PROMPT_SEEN_KEY = 'kupala-pwa-install-seen-v2'
const DISMISS_DAYS = 30

function isStandaloneMode(): boolean {
  if (typeof window === 'undefined') return false
  const nav = window.navigator as Navigator & { standalone?: boolean }
  return window.matchMedia('(display-mode: standalone)').matches || nav.standalone === true
}

function isMobileDevice(): boolean {
  if (typeof window === 'undefined') return false
  return window.matchMedia('(max-width: 768px)').matches || /android|iphone|ipad|ipod/i.test(window.navigator.userAgent)
}

function isIosDevice(): boolean {
  if (typeof window === 'undefined') return false
  return /iphone|ipad|ipod/i.test(window.navigator.userAgent)
}

function isDismissedNow(): boolean {
  if (typeof window === 'undefined') return true
  const raw = window.localStorage.getItem(DISMISS_UNTIL_KEY)
  if (!raw) return false
  const until = Number(raw)
  return Number.isFinite(until) && Date.now() < until
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
        // Force-activate a new SW as soon as it's found, and reload once
        // so the person always gets the latest deployed version.
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing
          if (!newWorker) return
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              newWorker.postMessage('SKIP_WAITING')
            }
          })
        })
        // Check for updates on every page load
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
        if (choice.outcome === 'accepted') {
          close(365)
        } else {
          close(14)
        }
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
    <div className="fixed inset-x-3 bottom-3 z-[9999] md:hidden animate-[fadeInUp_400ms_ease-out_forwards]" role="dialog" aria-live="polite">
      <div className="safe-bottom max-h-[70vh] overflow-auto rounded-[28px] border border-surface-variant/50 bg-surface-container-high p-4 text-on-surface shadow-2xl">
        <div className="flex items-start gap-3">
          
          {/* New PWA Icon syncing with brand */}
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[18px] bg-secondary shadow-sm overflow-hidden">
            <img src="/icon.svg" alt="Amado" className="w-full h-full object-cover" />
          </div>

          <div className="min-w-0 flex-1">
            <div className="text-sm font-bold">Adicionar Amado</div>
            <p className="mt-1 text-xs leading-5 text-on-surface-variant font-medium">
              Instale na área de trabalho para acesso rápido.
            </p>

            {showHelp && (
              <p className="mt-2 rounded-2xl bg-surface-container px-3 py-2 text-xs leading-5 text-on-surface-variant">
                No iPhone: Safari → &quot;Compartilhar&quot; → &quot;Adicionar à Tela de Início&quot;.
                No Android: Menu do navegador → &quot;Adicionar à tela inicial&quot;.
              </p>
            )}

            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={handleInstall}
                className="rounded-full bg-secondary px-5 py-2 text-xs font-bold tracking-wide text-on-secondary shadow-sm transition-opacity hover:opacity-90"
              >
                Adicionar
              </button>
              <button
                type="button"
                onClick={() => close(30)}
                className="rounded-full px-4 py-2 text-xs font-bold text-on-surface-variant transition-colors hover:bg-surface-variant/60"
              >
                Depois
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
