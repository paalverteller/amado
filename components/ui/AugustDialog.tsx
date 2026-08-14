'use client'

import { useEffect, useId, type ReactNode } from 'react'

interface AugustDialogProps {
  open: boolean
  onClose: () => void
  title: string
  eyebrow?: string
  description?: string
  children: ReactNode
  footer?: ReactNode
  size?: 'compact' | 'wide'
  className?: string
}

export default function AugustDialog({
  open,
  onClose,
  title,
  eyebrow,
  description,
  children,
  footer,
  size = 'compact',
  className = '',
}: AugustDialogProps) {
  const titleId = useId()

  useEffect(() => {
    if (!open) return
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = previous
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="aug-dialog-backdrop" onMouseDown={(event) => {
      if (event.currentTarget === event.target) onClose()
    }}>
      <section
        className={`aug-dialog ${size === 'wide' ? 'aug-dialog--wide' : ''} ${className}`.trim()}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <header className="aug-dialog__header">
          <div>
            {eyebrow ? <span className="aug-eyebrow">{eyebrow}</span> : null}
            <h2 id={titleId}>{title}</h2>
            {description ? <p>{description}</p> : null}
          </div>
          <button type="button" className="aug-icon-button" onClick={onClose} aria-label="Закрыть окно">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m7 7 10 10M17 7 7 17"/></svg>
          </button>
        </header>
        <div className="aug-dialog__body">{children}</div>
        {footer ? <footer className="aug-dialog__footer">{footer}</footer> : null}
      </section>
    </div>
  )
}
