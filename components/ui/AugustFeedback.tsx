'use client'

import { useEffect, useRef, useState } from 'react'

export type ToastKind = 'success' | 'error' | 'warning' | 'info'

export interface ToastOptions {
  title?: string
  message: string
  kind?: ToastKind
  duration?: number
}

type ToastItem = Required<Pick<ToastOptions, 'message' | 'kind'>> & {
  id: string
  title?: string
  duration: number
}

type ConfirmOptions = {
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  danger?: boolean
}

type ConfirmRequest = ConfirmOptions & {
  id: string
}

const TOAST_EVENT = 'amado:august-toast'
const CONFIRM_EVENT = 'amado:august-confirm'
const confirmResolvers = new Map<string, (value: boolean) => void>()

function uid(prefix: string): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return `${prefix}-${crypto.randomUUID()}`
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

export function showToast(options: ToastOptions | string): void {
  if (typeof window === 'undefined') return
  const normalized: ToastOptions = typeof options === 'string'
    ? { message: options, kind: 'info' }
    : options
  window.dispatchEvent(new CustomEvent<ToastOptions>(TOAST_EVENT, { detail: normalized }))
}

export const toast = {
  success(message: string, title?: string) {
    showToast({ message, title, kind: 'success' })
  },
  error(message: string, title?: string) {
    showToast({ message, title, kind: 'error', duration: 6000 })
  },
  warning(message: string, title?: string) {
    showToast({ message, title, kind: 'warning', duration: 5500 })
  },
  info(message: string, title?: string) {
    showToast({ message, title, kind: 'info' })
  },
}

export function confirmAction(options: ConfirmOptions): Promise<boolean> {
  if (typeof window === 'undefined') return Promise.resolve(false)
  const id = uid('confirm')
  return new Promise<boolean>((resolve) => {
    confirmResolvers.set(id, resolve)
    window.dispatchEvent(new CustomEvent<ConfirmRequest>(CONFIRM_EVENT, {
      detail: { ...options, id },
    }))
  })
}

function ToastIcon({ kind }: { kind: ToastKind }) {
  if (kind === 'success') {
    return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12 4 4L19 6"/></svg>
  }
  if (kind === 'error') {
    return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 8v5m0 3h.01"/><circle cx="12" cy="12" r="9"/></svg>
  }
  if (kind === 'warning') {
    return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 9v4m0 4h.01"/><path d="M10.3 4.5 3.3 17a2 2 0 0 0 1.7 3h14a2 2 0 0 0 1.7-3l-7-12.5a2 2 0 0 0-3.4 0Z"/></svg>
  }
  return <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 11v6m0-10h.01"/></svg>
}

export default function AugustFeedbackProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const [confirmRequest, setConfirmRequest] = useState<ConfirmRequest | null>(null)
  const timers = useRef(new Map<string, number>())

  useEffect(() => {
    const timerMap = timers.current

    function onToast(event: Event) {
      const detail = (event as CustomEvent<ToastOptions>).detail
      const item: ToastItem = {
        id: uid('toast'),
        title: detail.title,
        message: detail.message,
        kind: detail.kind ?? 'info',
        duration: detail.duration ?? 4200,
      }
      setToasts((current) => [...current.slice(-3), item])
      const timer = window.setTimeout(() => {
        setToasts((current) => current.filter((toastItem) => toastItem.id !== item.id))
        timerMap.delete(item.id)
      }, item.duration)
      timerMap.set(item.id, timer)
    }

    function onConfirm(event: Event) {
      setConfirmRequest((event as CustomEvent<ConfirmRequest>).detail)
    }

    window.addEventListener(TOAST_EVENT, onToast)
    window.addEventListener(CONFIRM_EVENT, onConfirm)

    const originalAlert = window.alert
    window.alert = (message?: unknown) => {
      showToast({
        message: String(message ?? ''),
        kind: 'info',
      })
    }

    return () => {
      window.removeEventListener(TOAST_EVENT, onToast)
      window.removeEventListener(CONFIRM_EVENT, onConfirm)
      window.alert = originalAlert
      for (const timer of timerMap.values()) window.clearTimeout(timer)
      timerMap.clear()
    }
  }, [])

  function dismissToast(id: string) {
    const timer = timers.current.get(id)
    if (timer) window.clearTimeout(timer)
    timers.current.delete(id)
    setToasts((current) => current.filter((item) => item.id !== id))
  }

  function settleConfirm(value: boolean) {
    if (!confirmRequest) return
    confirmResolvers.get(confirmRequest.id)?.(value)
    confirmResolvers.delete(confirmRequest.id)
    setConfirmRequest(null)
  }

  return (
    <>
      {children}

      <div className="aug-toast-region" aria-live="polite" aria-atomic="false">
        {toasts.map((item) => (
          <div key={item.id} className="aug-toast" data-kind={item.kind} role={item.kind === 'error' ? 'alert' : 'status'}>
            <span className="aug-toast__icon"><ToastIcon kind={item.kind} /></span>
            <div className="aug-toast__copy">
              {item.title ? <strong>{item.title}</strong> : null}
              <span>{item.message}</span>
            </div>
            <button type="button" className="aug-icon-button aug-toast__close" onClick={() => dismissToast(item.id)} aria-label="Закрыть уведомление">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m7 7 10 10M17 7 7 17"/></svg>
            </button>
          </div>
        ))}
      </div>

      {confirmRequest ? (
        <div className="aug-dialog-backdrop" role="presentation" onMouseDown={(event) => {
          if (event.currentTarget === event.target) settleConfirm(false)
        }}>
          <div className="aug-dialog aug-dialog--confirm" role="alertdialog" aria-modal="true" aria-labelledby="aug-confirm-title" aria-describedby="aug-confirm-message">
            <div className="aug-dialog__header">
              <div>
                <span className="aug-eyebrow">{confirmRequest.danger ? 'Требуется подтверждение' : 'Подтверждение'}</span>
                <h2 id="aug-confirm-title">{confirmRequest.title}</h2>
              </div>
            </div>
            <p id="aug-confirm-message" className="aug-dialog__message">{confirmRequest.message}</p>
            <div className="aug-dialog__footer">
              <button type="button" className="aug-button aug-button--secondary" onClick={() => settleConfirm(false)}>
                {confirmRequest.cancelLabel ?? 'Отмена'}
              </button>
              <button
                type="button"
                className={confirmRequest.danger ? 'aug-button aug-button--danger' : 'aug-button aug-button--primary'}
                onClick={() => settleConfirm(true)}
                autoFocus
              >
                {confirmRequest.confirmLabel ?? 'Продолжить'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}
