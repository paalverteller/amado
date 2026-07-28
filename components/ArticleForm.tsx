'use client'

import { useState, useEffect } from 'react'

type ArticleFormData = {
  topic: string
  contentType: string
  templateId: string
  bookId: string
}

type BookOption = {
  id: string
  title: string
}

type BooksResponse = {
  books?: BookOption[]
}

type ArticleFormProps = {
  onSubmit: (data: ArticleFormData) => void
  isLoading: boolean
}

export default function ArticleForm({ onSubmit, isLoading }: ArticleFormProps) {
  const [topic, setTopic] = useState('')
  const [contentType, setContentType] = useState('article')
  const [templateId, setTemplateId] = useState('')
  const [bookId, setBookId] = useState('')
  const [books, setBooks] = useState<BookOption[]>([])

  useEffect(() => {
    fetch('/api/books')
      .then(res => res.json() as Promise<BooksResponse>)
      .then(data => {
        if (data.books) setBooks(data.books)
      })
      .catch(() => console.log('Knowledge base not yet available'))
  }, [])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSubmit({ topic, contentType, templateId, bookId })
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-[#E8E4DF] shadow-[0_2px_8px_rgba(0,0,0,0.06)] p-6 space-y-4">
      <div>
        <label className="block text-sm font-medium text-[#6B7280] mb-1 font-sans">Tema do conteúdo</label>
        <input
          type="text"
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          placeholder="Ex: Como lidar com burnout"
          className="w-full px-4 py-3 rounded-xl border border-[#E8E4DF] bg-white focus:outline-none focus:ring-2 focus:ring-[#0072C9]/20 focus:border-[#0072C9] transition-all duration-150 text-sm font-sans"
          required
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-[#6B7280] mb-1 font-sans">Tipo de conteúdo</label>
          <select
            value={contentType}
            onChange={(e) => setContentType(e.target.value)}
            className="w-full px-4 py-3 rounded-xl border border-[#E8E4DF] bg-white focus:outline-none focus:ring-2 focus:ring-[#0072C9]/20 focus:border-[#0072C9] transition-all duration-150 text-sm font-sans"
          >
            <option value="article">Artigo</option>
            <option value="post">Post</option>
            <option value="concept">Análise de conceito</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-[#6B7280] mb-1 font-sans">Estilo (Template)</label>
          <select
            value={templateId}
            onChange={(e) => setTemplateId(e.target.value)}
            className="w-full px-4 py-3 rounded-xl border border-[#E8E4DF] bg-white focus:outline-none focus:ring-2 focus:ring-[#0072C9]/20 focus:border-[#0072C9] transition-all duration-150 text-sm font-sans"
          >
            <option value="">— Sem estilo (básico) —</option>
            <option value="scientific-v1.0">Divulgação científica</option>
            <option value="social-v1.0">Post para redes sociais</option>
            <option value="case-v1.0">Análise de caso</option>
            <option value="review-v1.0">Análise de artigo ou livro</option>
            <option value="story-v1.0">Storytelling</option>
          </select>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-[#6B7280] mb-1 font-sans">Base de conhecimento (Contexto)</label>
        <select
          value={bookId}
          onChange={(e) => setBookId(e.target.value)}
          className="w-full px-4 py-3 rounded-xl border border-[#E8E4DF] bg-white focus:outline-none focus:ring-2 focus:ring-[#0072C9]/20 focus:border-[#0072C9] transition-all duration-150 text-sm font-sans"
        >
          <option value="">— Sem contexto de livro —</option>
          {books.map(book => (
            <option key={book.id} value={book.id}>{book.title}</option>
          ))}
        </select>
      </div>

      <button
        type="submit"
        disabled={isLoading || !topic}
        className={`w-full px-6 py-3 rounded-xl font-medium transition-all duration-150 font-sans mt-4 ${
          isLoading || !topic
            ? 'bg-[#E8E4DF] text-[#6B7280] cursor-not-allowed'
            : 'bg-[#F4845F] text-white hover:bg-[#E8704A] active:scale-95 shadow-sm'
        }`}
      >
        {isLoading ? 'Gerando...' : 'Criar conteúdo'}
      </button>
    </form>
  )
}
