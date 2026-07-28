'use client'

import { useState, useEffect } from 'react'

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

  useEffect(() => {
    if (!brandId) {
      setLoading(false)
      return
    }
    fetchData()
  }, [brandId])

  async function fetchData() {
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
  }

  if (!brandId) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Selecione uma marca para visualizar os dados</p>
      </div>
    )
  }

  if (loading) {
    return <div className="text-center py-12">Carregando...</div>
  }

  return (
    <div className="space-y-6">
      {/* Section Toggle */}
      <div className="flex space-x-4 border-b border-gray-200">
        <button
          onClick={() => setActiveSection('audiences')}
          className={`pb-3 text-sm font-medium border-b-2 transition-colors ${
            activeSection === 'audiences'
              ? 'border-blue-500 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          Públicos ({audiences.length})
        </button>
        <button
          onClick={() => setActiveSection('pains')}
          className={`pb-3 text-sm font-medium border-b-2 transition-colors ${
            activeSection === 'pains'
              ? 'border-blue-500 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          Pontos de Dor ({painPoints.length})
        </button>
      </div>

      {activeSection === 'audiences' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {audiences.map((audience) => (
            <div key={audience.id} className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">{audience.name}</h3>
                <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs">
                  {audience.technicalDetailLevel}
                </span>
              </div>
              
              <div className="space-y-4">
                <div>
                  <h4 className="text-sm font-medium text-gray-700 mb-2">Funções</h4>
                  <div className="flex flex-wrap gap-2">
                    {audience.roles?.map((role, i) => (
                      <span key={i} className="px-2 py-1 bg-gray-100 text-gray-600 rounded text-sm">
                        {role}
                      </span>
                    ))}
                  </div>
                </div>

                <div>
                  <h4 className="text-sm font-medium text-gray-700 mb-2">Dores</h4>
                  <ul className="space-y-1">
                    {audience.pains?.map((pain, i) => (
                      <li key={i} className="text-sm text-gray-600 flex items-start">
                        <span className="text-red-500 mr-2">•</span>
                        {pain}
                      </li>
                    ))}
                  </ul>
                </div>

                <div>
                  <h4 className="text-sm font-medium text-gray-700 mb-2">Objetivos Desejados</h4>
                  <ul className="space-y-1">
                    {audience.desiredOutcomes?.map((outcome, i) => (
                      <li key={i} className="text-sm text-gray-600 flex items-start">
                        <span className="text-green-500 mr-2">→</span>
                        {outcome}
                      </li>
                    ))}
                  </ul>
                </div>

                {audience.objections && audience.objections.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium text-gray-700 mb-2">Objeções</h4>
                    <ul className="space-y-1">
                      {audience.objections.map((obj, i) => (
                        <li key={i} className="text-sm text-gray-600 flex items-start">
                          <span className="text-yellow-500 mr-2">⚠</span>
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
            <div key={pain.id} className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">{pain.canonicalName}</h3>
              <p className="text-gray-600 mb-4">{pain.description}</p>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <h4 className="text-sm font-medium text-gray-700 mb-2">Sintomas Observáveis</h4>
                  <ul className="space-y-1">
                    {pain.observableSymptoms?.map((symptom, i) => (
                      <li key={i} className="text-sm text-gray-600 flex items-start">
                        <span className="text-orange-500 mr-2">🔍</span>
                        {symptom}
                      </li>
                    ))}
                  </ul>
                </div>

                <div>
                  <h4 className="text-sm font-medium text-gray-700 mb-2">Consequências de Negócio</h4>
                  <ul className="space-y-1">
                    {pain.businessConsequences?.map((consequence, i) => (
                      <li key={i} className="text-sm text-gray-600 flex items-start">
                        <span className="text-red-500 mr-2">💸</span>
                        {consequence}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {pain.approvedBrazilianExamples && pain.approvedBrazilianExamples.length > 0 && (
                <div className="mt-4 p-4 bg-yellow-50 rounded-lg">
                  <h4 className="text-sm font-medium text-yellow-800 mb-2">Exemplos Brasileiros Aprovados</h4>
                  <div className="flex flex-wrap gap-2">
                    {pain.approvedBrazilianExamples.map((example, i) => (
                      <span key={i} className="px-3 py-1 bg-yellow-100 text-yellow-800 rounded-full text-sm">
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
