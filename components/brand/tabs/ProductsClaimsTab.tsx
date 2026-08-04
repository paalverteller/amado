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

  if (!brandId) return <div className="text-center py-12 text-gray-500">Выберите бренд</div>
  if (loading) return <div className="text-center py-12">Загрузка...</div>

  const claimTypeLabel = (type: Claim['claimType']) =>
    type === 'approved' ? 'Разрешено' :
    type === 'forbidden' ? 'Запрещено' :
    type === 'requires_proof' ? 'Требует доказательства' : 'С оговоркой'

  return (
    <div className="space-y-6">
      <div className="flex space-x-4 border-b border-gray-200">
        <button onClick={() => setActiveSection('products')} className={`pb-3 text-sm font-medium border-b-2 ${activeSection === 'products' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500'}`}>
          Продукты ({products.length})
        </button>
        <button onClick={() => setActiveSection('claims')} className={`pb-3 text-sm font-medium border-b-2 ${activeSection === 'claims' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500'}`}>
          Утверждения ({claims.length})
        </button>
      </div>

      {activeSection === 'products' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {products.map(p => (
            <div key={p.id} className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-lg font-semibold">{p.name}</h3>
                <span className={`px-2 py-1 rounded text-xs ${p.productRole === 'infrastructure' ? 'bg-gray-100 text-gray-700' : 'bg-blue-100 text-blue-700'}`}>{p.productRole}</span>
              </div>
              <p className="text-gray-600 text-sm">{p.description}</p>
            </div>
          ))}
        </div>
      )}

      {activeSection === 'claims' && (
        <div className="space-y-3">
          {claims.map(c => (
            <div key={c.id} className={`bg-white rounded-lg shadow p-4 border-l-4 ${
              c.claimType === 'approved' ? 'border-green-500' : 
              c.claimType === 'forbidden' ? 'border-red-500' : 
              c.claimType === 'requires_proof' ? 'border-yellow-500' : 'border-blue-500'
            }`}>
              <div className="flex items-center justify-between">
                <p className="text-gray-800">{c.claimText}</p>
                <span className={`px-2 py-1 rounded text-xs ${
                  c.claimType === 'approved' ? 'bg-green-100 text-green-800' :
                  c.claimType === 'forbidden' ? 'bg-red-100 text-red-800' :
                  c.claimType === 'requires_proof' ? 'bg-yellow-100 text-yellow-800' :
                  'bg-blue-100 text-blue-800'
                }`}>{claimTypeLabel(c.claimType)}</span>
              </div>
              {c.qualifier && <p className="text-sm text-gray-500 mt-1">Оговорка: {c.qualifier}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}