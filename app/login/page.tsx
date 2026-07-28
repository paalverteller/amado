'use client'

import { useState, FormEvent } from 'react'

export default function LoginPage() {
  const [password, setPassword] = useState('')
  const [error, setError]       = useState('')
  const [loading, setLoading]   = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await fetch('/api/auth', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ password }),
      })
      if (res.ok) {
        window.location.href = '/generate'
      } else {
        const data = await res.json() as { error: string }
        setError(data.error ?? 'Senha incorreta')
      }
    } catch {
      setError('Erro de conexão')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="min-h-screen relative flex flex-col items-center justify-center p-4 font-sans"
      style={{
        background: 'linear-gradient(160deg, #1E3A8A 0%, #2D55B0 35%, #4A6FD4 65%, #EEF2FF 100%)',
      }}
    >
      {/* Subtle grid pattern overlay */}
      <div
        style={{
          position: 'absolute', inset: 0, pointerEvents: 'none', opacity: 0.06,
          backgroundImage: 'linear-gradient(rgba(255,255,255,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.6) 1px, transparent 1px)',
          backgroundSize: '40px 40px',
        }}
      />

      <div
        className="w-full relative"
        style={{ maxWidth: 400, animation: 'fadeInUp 500ms cubic-bezier(0.05,0.7,0.1,1) both' }}
      >
        {/* Brand mark */}
        <div className="text-center mb-8">
          <div
            className="inline-flex items-center justify-center mb-5"
            style={{
              width: 64, height: 64,
              borderRadius: 20,
              background: 'rgba(255,255,255,0.15)',
              backdropFilter: 'blur(12px)',
              border: '1px solid rgba(255,255,255,0.25)',
              boxShadow: '0 8px 32px rgba(0,0,0,0.20)',
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/icon-nobg.svg" alt="Amado" style={{ width: 40, height: 40, objectFit: 'contain' }} />
          </div>
          <h1
            className="m-0 text-white font-bold"
            style={{ fontFamily: 'var(--font-display)', fontSize: 28, letterSpacing: '-0.02em', lineHeight: 1.2 }}
          >
            Amado
          </h1>
          <p
            className="m-0 mt-1.5 font-semibold uppercase"
            style={{ fontSize: 10, letterSpacing: '0.16em', color: 'rgba(255,255,255,0.55)' }}
          >
            Content Pipeline · Brasil · 2026
          </p>
        </div>

        {/* Login Card */}
        <div
          style={{
            background: 'rgba(255,255,255,0.92)',
            backdropFilter: 'blur(24px)',
            WebkitBackdropFilter: 'blur(24px)',
            border: '1px solid rgba(255,255,255,0.60)',
            borderRadius: 24,
            padding: '2rem',
            boxShadow: '0 24px 64px rgba(15,23,42,0.22), 0 4px 16px rgba(15,23,42,0.10)',
          }}
        >
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div>
              <label
                htmlFor="password"
                style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--color-on-surface-variant)', marginBottom: '0.5rem', letterSpacing: '0.01em' }}
              >
                Senha de acesso
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                autoFocus
                required
                className="m3-input-outlined"
                style={{ height: 48, fontSize: 15, letterSpacing: '0.05em' }}
              />
            </div>

            {error && (
              <p
                style={{
                  margin: 0, fontSize: 13, fontWeight: 500,
                  padding: '0.75rem 1rem', borderRadius: 12,
                  background: 'var(--color-error-container)',
                  color: 'var(--color-on-error-container)',
                  border: '1px solid rgba(220,38,38,0.15)',
                }}
              >
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading || !password}
              className="m3-button-filled"
              style={{ width: '100%', height: 48, fontSize: 15, borderRadius: 14, marginTop: '0.25rem' }}
            >
              {loading ? 'Entrando...' : 'Entrar'}
            </button>
          </form>
        </div>

        <p
          className="text-center mt-6"
          style={{ fontSize: 11, color: 'rgba(255,255,255,0.40)', letterSpacing: '0.04em' }}
        >
          Sistema protegido por senha
        </p>
      </div>
    </div>
  )
}
