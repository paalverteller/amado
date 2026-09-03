'use client'

import { useState, useEffect, useCallback } from 'react'

interface Audience {
  id: string
  name: string
  roles: string[]
  companyProfile: string
  pains: string[]
  desiredOutcomes: string[]
  objections: string[]
  technicalDetailLevel: string
}

interface PainPoint {
  id: string
  canonicalName: string
  description: string
  observableSymptoms: string[]
  businessConsequences: string[]
  approvedBrazilianExamples: string[]
}

export default function AudiencePainsTab({ brandId }: { brandId: string }) {
  const [audiences, setAudiences] = useState<Audience[]>([])
  const [painPoints, setPainPoints] = useState<PainPoint[]>([])
  const [loading, setLoading] = useState(true)
  const [activeSection, setActiveSection] = useState<'audiences' | 'pains'>('audiences')

  const fetchData = useCallback(async () => {
    try {
      const [audiencesRes, painsRes] = await Promise.all([
        fetch(`/api/brands/${brandId}/audiences`),
        fetch(`/api/brands/${brandId}/pain-points`),
      ])

      if (audiencesRes.ok) {
        const data = await audiencesRes.json()
        setAudiences(data.audiences || [])
      }
      if (painsRes.ok) {
        const data = await painsRes.json()
        setPainPoints(data.painPoints || [])
      }
    } catch (err) {
      console.error('Failed to fetch audience/pain data:', err)
    } finally {
      setLoading(false)
    }
  }, [brandId])

  useEffect(() => {
    if (!brandId) return
    // Confirmed false positive for "call a memoized async fetcher from an
    // effect"; see https://github.com/facebook/react/issues/34743
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchData()
  }, [brandId, fetchData])

  if (!brandId) {
    return (
      <div className="text-center py-12">
        <p style={{ color: 'var(--aug-muted)' }}>Выберите бренд, чтобы увидеть данные</p>
      </div>
    )
  }

  if (loading) {
    return <div className="text-center py-12" style={{ color: 'var(--aug-muted)' }}>Загрузка...</div>
  }

  return (
    <div className="space-y-6">
      {/* Section Toggle */}
      <div className="flex space-x-4 border-b" style={{ borderColor: 'var(--aug-border)' }}>
        <button
          onClick={() => setActiveSection('audiences')}
          className="pb-3 text-sm font-medium border-b-2 transition-colors"
          style={
            activeSection === 'audiences'
              ? { borderColor: 'var(--aug-accent)', color: 'var(--aug-accent)' }
              : { borderColor: 'transparent', color: 'var(--aug-muted)' }
          }
        >
          Аудитории ({audiences.length})
        </button>
        <button
          onClick={() => setActiveSection('pains')}
          className="pb-3 text-sm font-medium border-b-2 transition-colors"
          style={
            activeSection === 'pains'
              ? { borderColor: 'var(--aug-accent)', color: 'var(--aug-accent)' }
              : { borderColor: 'transparent', color: 'var(--aug-muted)' }
          }
        >
          Болевые точки ({painPoints.length})
        </button>
      </div>

      {activeSection === 'audiences' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {audiences.map((audience) => (
            <div key={audience.id} className="m3-card p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold" style={{ color: 'var(--aug-ink)' }}>{audience.name}</h3>
                <span
                  className="px-2 py-1 rounded text-xs"
                  style={{ background: 'var(--aug-accent-bg)', color: 'var(--aug-accent-fg)' }}
                >
                  {audience.technicalDetailLevel}
                </span>
              </div>
              
              <div className="space-y-4">
                <div>
                  <h4 className="text-sm font-medium mb-2" style={{ color: 'var(--aug-ink)' }}>Роли</h4>
                  <div className="flex flex-wrap gap-2">
                    {audience.roles?.map((role, i) => (
                      <span
                        key={i}
                        className="px-2 py-1 rounded text-sm"
                        style={{ background: 'var(--aug-neutral-bg)', color: 'var(--aug-neutral-fg)' }}
                      >
                        {role}
                      </span>
                    ))}
                  </div>
                </div>

                <div>
                  <h4 className="text-sm font-medium mb-2" style={{ color: 'var(--aug-ink)' }}>Боли</h4>
                  <ul className="space-y-1">
                    {audience.pains?.map((pain, i) => (
                      <li key={i} className="text-sm flex items-start" style={{ color: 'var(--aug-muted)' }}>
                        <span className="mr-2" style={{ color: 'var(--aug-danger-fg)' }}>•</span>
                        {pain}
                      </li>
                    ))}
                  </ul>
                </div>

                <div>
                  <h4 className="text-sm font-medium mb-2" style={{ color: 'var(--aug-ink)' }}>Желаемые результаты</h4>
                  <ul className="space-y-1">
                    {audience.desiredOutcomes?.map((outcome, i) => (
                      <li key={i} className="text-sm flex items-start" style={{ color: 'var(--aug-muted)' }}>
                        <span className="mr-2" style={{ color: 'var(--aug-success-fg)' }}>→</span>
                        {outcome}
                      </li>
                    ))}
                  </ul>
                </div>

                {audience.objections && audience.objections.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium mb-2" style={{ color: 'var(--aug-ink)' }}>Возражения</h4>
                    <ul className="space-y-1">
                      {audience.objections.map((obj, i) => (
                        <li key={i} className="text-sm flex items-start" style={{ color: 'var(--aug-muted)' }}>
                          <span className="mr-2" style={{ color: 'var(--aug-warning-fg)' }}>⚠</span>
                          {obj}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {activeSection === 'pains' && (
        <div className="space-y-4">
          {painPoints.map((pain) => (
            <div key={pain.id} className="m3-card p-6">
              <h3 className="text-lg font-semibold mb-2" style={{ color: 'var(--aug-ink)' }}>{pain.canonicalName}</h3>
              <p className="mb-4" style={{ color: 'var(--aug-muted)' }}>{pain.description}</p>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <h4 className="text-sm font-medium mb-2" style={{ color: 'var(--aug-ink)' }}>Наблюдаемые симптомы</h4>
                  <ul className="space-y-1">
                    {pain.observableSymptoms?.map((symptom, i) => (
                      <li key={i} className="text-sm flex items-start" style={{ color: 'var(--aug-muted)' }}>
                        <span className="mr-2" style={{ color: 'var(--aug-warning-fg)' }}>🔍</span>
                        {symptom}
                      </li>
                    ))}
                  </ul>
                </div>

                <div>
                  <h4 className="text-sm font-medium mb-2" style={{ color: 'var(--aug-ink)' }}>Бизнес-последствия</h4>
                  <ul className="space-y-1">
                    {pain.businessConsequences?.map((consequence, i) => (
                      <li key={i} className="text-sm flex items-start" style={{ color: 'var(--aug-muted)' }}>
                        <span className="mr-2" style={{ color: 'var(--aug-danger-fg)' }}>💸</span>
                        {consequence}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {pain.approvedBrazilianExamples && pain.approvedBrazilianExamples.length > 0 && (
                <div className="mt-4 p-4 rounded-2xl" style={{ background: 'var(--aug-warning-bg)' }}>
                  <h4 className="text-sm font-medium mb-2" style={{ color: 'var(--aug-warning-fg)' }}>Одобренные примеры</h4>
                  <div className="flex flex-wrap gap-2">
                    {pain.approvedBrazilianExamples.map((example, i) => (
                      <span
                        key={i}
                        className="px-3 py-1 rounded-full text-sm"
                        style={{ background: 'var(--aug-warning-bg)', color: 'var(--aug-warning-fg)' }}
                      >
                        {example}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
