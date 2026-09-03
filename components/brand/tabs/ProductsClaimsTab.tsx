'use client'

import { useState, useEffect, useCallback } from 'react'

interface Product {
  id: string
  name: string
  slug: string
  description: string
  productRole: string
  active: boolean
}

interface Claim {
  id: string
  claimText: string
  claimType: 'approved' | 'qualified' | 'forbidden' | 'requires_proof'
  qualifier: string
  status: string
}

const CLAIM_BORDER_COLOR: Record<Claim['claimType'], string> = {
  approved: 'var(--aug-success-fg)',
  forbidden: 'var(--aug-danger-fg)',
  requires_proof: 'var(--aug-warning-fg)',
  qualified: 'var(--aug-accent)',
}

const CLAIM_BADGE_STYLE: Record<Claim['claimType'], { background: string; color: string }> = {
  approved: { background: 'var(--aug-success-bg)', color: 'var(--aug-success-fg)' },
  forbidden: { background: 'var(--aug-danger-bg)', color: 'var(--aug-danger-fg)' },
  requires_proof: { background: 'var(--aug-warning-bg)', color: 'var(--aug-warning-fg)' },
  qualified: { background: 'var(--aug-accent-bg)', color: 'var(--aug-accent-fg)' },
}

export default function ProductsClaimsTab({ brandId }: { brandId: string }) {
  const [products, setProducts] = useState<Product[]>([])
  const [claims, setClaims] = useState<Claim[]>([])
  const [loading, setLoading] = useState(true)
  const [activeSection, setActiveSection] = useState<'products' | 'claims'>('products')

  const fetchData = useCallback(async () => {
    try {
      const [productsRes, claimsRes] = await Promise.all([
        fetch(`/api/brands/${brandId}/products`),
        fetch(`/api/brands/${brandId}/claims`),
      ])
      if (productsRes.ok) setProducts((await productsRes.json()).products || [])
      if (claimsRes.ok) setClaims((await claimsRes.json()).claims || [])
    } catch (err) { console.error(err) }
    finally { setLoading(false) }
  }, [brandId])

  useEffect(() => {
    if (!brandId) return
    // Confirmed false positive for "call a memoized async fetcher from an
    // effect"; see https://github.com/facebook/react/issues/34743
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchData()
  }, [brandId, fetchData])

  if (!brandId) return <div className="text-center py-12" style={{ color: 'var(--aug-muted)' }}>Выберите бренд</div>
  if (loading) return <div className="text-center py-12" style={{ color: 'var(--aug-muted)' }}>Загрузка...</div>

  const claimTypeLabel = (type: Claim['claimType']) =>
    type === 'approved' ? 'Разрешено' :
    type === 'forbidden' ? 'Запрещено' :
    type === 'requires_proof' ? 'Требует доказательства' : 'С оговоркой'

  return (
    <div className="space-y-6">
      <div className="flex space-x-4 border-b" style={{ borderColor: 'var(--aug-border)' }}>
        <button
          onClick={() => setActiveSection('products')}
          className="pb-3 text-sm font-medium border-b-2"
          style={
            activeSection === 'products'
              ? { borderColor: 'var(--aug-accent)', color: 'var(--aug-accent)' }
              : { borderColor: 'transparent', color: 'var(--aug-muted)' }
          }
        >
          Продукты ({products.length})
        </button>
        <button
          onClick={() => setActiveSection('claims')}
          className="pb-3 text-sm font-medium border-b-2"
          style={
            activeSection === 'claims'
              ? { borderColor: 'var(--aug-accent)', color: 'var(--aug-accent)' }
              : { borderColor: 'transparent', color: 'var(--aug-muted)' }
          }
        >
          Утверждения ({claims.length})
        </button>
      </div>

      {activeSection === 'products' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {products.map(p => (
            <div key={p.id} className="m3-card p-6">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-lg font-semibold" style={{ color: 'var(--aug-ink)' }}>{p.name}</h3>
                <span
                  className="px-2 py-1 rounded text-xs"
                  style={
                    p.productRole === 'infrastructure'
                      ? { background: 'var(--aug-neutral-bg)', color: 'var(--aug-neutral-fg)' }
                      : { background: 'var(--aug-accent-bg)', color: 'var(--aug-accent-fg)' }
                  }
                >
                  {p.productRole}
                </span>
              </div>
              <p className="text-sm" style={{ color: 'var(--aug-muted)' }}>{p.description}</p>
            </div>
          ))}
        </div>
      )}

      {activeSection === 'claims' && (
        <div className="space-y-3">
          {claims.map(c => (
            <div
              key={c.id}
              className="m3-card p-4"
              style={{ borderLeft: `4px solid ${CLAIM_BORDER_COLOR[c.claimType]}` }}
            >
              <div className="flex items-center justify-between">
                <p style={{ color: 'var(--aug-ink)' }}>{c.claimText}</p>
                <span
                  className="px-2 py-1 rounded text-xs"
                  style={CLAIM_BADGE_STYLE[c.claimType]}
                >
                  {claimTypeLabel(c.claimType)}
                </span>
              </div>
              {c.qualifier && <p className="text-sm mt-1" style={{ color: 'var(--aug-muted)' }}>Оговорка: {c.qualifier}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
