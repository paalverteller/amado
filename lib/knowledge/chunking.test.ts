import { describe, expect, it } from 'vitest'
import { normalizeText, detectLanguage, chunkText } from './chunking'

describe('knowledge/chunking — normalizeText', () => {
  it('normalizes CRLF to LF', () => {
    expect(normalizeText('a\r\nb\r\nc')).toBe('a\nb\nc')
  })
  it('collapses 3+ blank lines to one blank line', () => {
    expect(normalizeText('a\n\n\n\n\nb')).toBe('a\n\nb')
  })
  it('collapses runs of spaces', () => {
    expect(normalizeText('a   b')).toBe('a b')
  })
  it('trims leading/trailing whitespace', () => {
    expect(normalizeText('  hi  ')).toBe('hi')
  })
})

describe('knowledge/chunking — detectLanguage', () => {
  it('detects Russian from Cyrillic ratio', () => {
    expect(detectLanguage('Привет, как дела? Это русский текст для проверки определения языка.')).toBe('ru')
  })
  it('detects Portuguese (Brazil) from diacritics and function words', () => {
    expect(detectLanguage('Não é possível criar isso agora, você está em uma situação complicada.')).toBe('pt-BR')
  })
  it('falls back to English for plain Latin text', () => {
    expect(detectLanguage('This is a plain English sentence with no special characters at all.')).toBe('en')
  })
  it('returns und for empty or letterless input', () => {
    expect(detectLanguage('   ')).toBe('und')
    expect(detectLanguage('123 456 !!! ???')).toBe('und')
  })
})

describe('knowledge/chunking — chunkText', () => {
  it('returns zero chunks for empty text', () => {
    expect(chunkText('   ')).toHaveLength(0)
  })

  it('keeps a short text as a single chunk with accurate charCount', () => {
    const chunks = chunkText('Just one short paragraph.')
    expect(chunks).toHaveLength(1)
    expect(chunks[0].content).toBe('Just one short paragraph.')
    expect(chunks[0].charCount).toBe(chunks[0].content.length)
  })

  it('packs many small paragraphs into fewer, larger chunks', () => {
    const manyParas = Array.from(
      { length: 20 },
      (_, i) => `Paragraph number ${i} with some reasonable amount of filler text to pad it out a bit.`,
    ).join('\n\n')
    const chunks = chunkText(manyParas)
    expect(chunks.length).toBeGreaterThan(0)
    expect(chunks.length).toBeLessThan(20)
    for (const c of chunks) expect(c.content.length).toBeLessThanOrEqual(1850)
  })

  it('preserves every word — packing must not lose content', () => {
    const manyParas = Array.from(
      { length: 20 },
      (_, i) => `Paragraph number ${i} with some reasonable amount of filler text to pad it out a bit.`,
    ).join('\n\n')
    const chunks = chunkText(manyParas)
    const originalWords = manyParas.split(/\s+/).filter(Boolean).sort()
    const reconstructedWords = chunks.map((c) => c.content).join(' ').split(/\s+/).filter(Boolean).sort()
    expect(reconstructedWords).toEqual(originalWords)
  })

  it('hard-splits a single oversized paragraph with no blank-line breaks', () => {
    const hugeSentence = Array.from({ length: 200 }, (_, i) => `This is sentence number ${i} in one giant paragraph.`).join(' ')
    const chunks = chunkText(hugeSentence)
    expect(chunks.length).toBeGreaterThan(1)
    for (const c of chunks) expect(c.content.length).toBeLessThanOrEqual(1860)
  })
})
