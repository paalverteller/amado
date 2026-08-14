'use client'

import { useState, type FormEvent } from 'react'

export default function LoginPage() {
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError('')
    setLoading(true)
    try {
      const response = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      })

      if (response.ok) {
        window.location.href = '/overview'
        return
      }

      const data = await response.json().catch(() => ({})) as { error?: string }
      setError(data.error ?? 'Неверный пароль')
    } catch {
      setError('Не удалось подключиться. Проверьте соединение и попробуйте ещё раз.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="aug-auth">
      <div className="aug-auth__frame">
        <section className="aug-auth__story" aria-label="О продукте">
          <div>
            <div className="aug-brand">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/amado-icon.svg" alt="" className="aug-brand__mark" />
              <span className="aug-brand__copy">
                <strong>amado</strong>
                <small>marketing intelligence</small>
              </span>
            </div>

            <h1>Рабочий стол маркетолога, который <mark>понимает контекст.</mark></h1>
            <p>
              Рынок, конкуренты, Brand OS, контент и результаты — в одном спокойном рабочем пространстве для команды, которая развивает бренд в Бразилии.
            </p>
          </div>

          <div className="aug-auth__signal">
            <span className="aug-growth-note__dot" />
            Brazil · Brand · Evidence · Performance
          </div>
        </section>

        <section className="aug-auth__card">
          <span className="aug-eyebrow">Private workspace</span>
          <h2>Войти в Amado</h2>
          <p>Используйте пароль рабочего пространства.</p>

          <form onSubmit={handleSubmit} className="grid gap-4">
            <label className="aug-field">
              <span>Пароль</span>
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="••••••••"
                autoComplete="current-password"
                autoFocus
                required
                aria-invalid={Boolean(error)}
                aria-describedby={error ? 'login-error' : undefined}
              />
            </label>

            {error ? (
              <div id="login-error" className="rounded-[13px] border px-3 py-2 text-xs font-semibold" style={{
                background: 'var(--aug-danger-bg)',
                color: 'var(--aug-danger-fg)',
                borderColor: 'rgba(164,63,63,.16)',
              }} role="alert">
                {error}
              </div>
            ) : null}

            <button type="submit" className="aug-button aug-button--primary aug-button--full" disabled={loading || !password} aria-busy={loading}>
              {loading ? 'Вхожу…' : 'Войти'}
            </button>
          </form>
        </section>
      </div>
    </main>
  )
}
