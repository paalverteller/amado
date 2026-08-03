/**
 * Text-first knowledge processing (plan §7.4): normalize → detect
 * language → split by headings/paragraphs → pack into chunks.
 * Deliberately dependency-free — no NLP library, just regex heuristics.
 * Good enough for the MVP acceptance bar (§7: "uploaded text becomes
 * searchable"), not intended to be a general-purpose tokenizer.
 */

export interface TextChunk {
  content: string
  charCount: number
}

const MIN_CHUNK_CHARS = 200
const TARGET_CHUNK_CHARS = 1200
const MAX_CHUNK_CHARS = 1800

/** Normalize encoding artifacts and excessive whitespace (plan §7.4 steps 2-3). */
export function normalizeText(raw: string): string {
  return raw
    .replace(/\r\n?/g, '\n')     // CRLF/CR -> LF
    .replace(/\u0000/g, '')      // stray null bytes from bad encodings
    .replace(/[ \t]+\n/g, '\n')  // trailing spaces before newline
    .replace(/\n{3,}/g, '\n\n')  // collapse 3+ blank lines to 1
    .replace(/[ \t]{2,}/g, ' ')  // collapse runs of spaces/tabs
    .trim()
}

/**
 * Lightweight heuristic language detector (plan §7.4 step 4). Not a real
 * NLP model — just enough to populate the `language` metadata field for
 * ru / pt-BR / en, the three languages this product actually deals with
 * (UI is Russian, market content is pt-BR, source material is often
 * English). Falls back to 'und' (undetermined) rather than guessing
 * wrong with false confidence.
 */
export function detectLanguage(text: string): 'ru' | 'pt-BR' | 'en' | 'und' {
  const sample = text.slice(0, 2000)
  if (!sample.trim()) return 'und'

  const cyrillic = (sample.match(/[\u0400-\u04FF]/g) ?? []).length
  const letters = (sample.match(/[a-zA-Zа-яА-ЯёЁ]/g) ?? []).length
  if (letters === 0) return 'und'
  if (cyrillic / letters > 0.3) return 'ru'

  // pt-BR tells: accented vowels common in Portuguese + a few very common
  // function words that don't appear in English.
  const ptSignals = (sample.match(/[ãõáéíóúâêôç]/gi) ?? []).length
  const ptWords = (sample.match(/\b(não|você|para|com|uma|são|está|isso)\b/gi) ?? []).length
  if (ptSignals > 3 || ptWords > 2) return 'pt-BR'

  return 'en'
}

/**
 * Splits normalized text into paragraphs, then greedily packs consecutive
 * paragraphs into chunks around TARGET_CHUNK_CHARS. A single paragraph
 * longer than MAX_CHUNK_CHARS is hard-split on sentence boundaries so no
 * chunk is unboundedly large (protects the embeddings API's per-input
 * limits and keeps retrieval granularity reasonable).
 */
export function chunkText(text: string): TextChunk[] {
  const normalized = normalizeText(text)
  if (!normalized) return []

  const blocks = normalized
    .split(/\n\s*\n/)
    .map((b) => b.trim())
    .filter(Boolean)

  const chunks: TextChunk[] = []
  let buffer = ''

  const flush = () => {
    const content = buffer.trim()
    if (content) chunks.push({ content, charCount: content.length })
    buffer = ''
  }

  for (const block of blocks) {
    const candidate = buffer ? `${buffer}\n\n${block}` : block

    if (candidate.length <= TARGET_CHUNK_CHARS) {
      buffer = candidate
      continue
    }

    if (buffer.length >= MIN_CHUNK_CHARS) {
      flush()
    }

    if (block.length <= MAX_CHUNK_CHARS) {
      buffer = block
    } else {
      for (const piece of hardSplit(block)) {
        chunks.push({ content: piece, charCount: piece.length })
      }
      buffer = ''
    }
  }
  flush()

  return chunks
}

function hardSplit(block: string): string[] {
  const sentences = block.split(/(?<=[.!?])\s+/)
  const pieces: string[] = []
  let current = ''
  for (const sentence of sentences) {
    const candidate = current ? `${current} ${sentence}` : sentence
    if (candidate.length > MAX_CHUNK_CHARS && current) {
      pieces.push(current.trim())
      current = sentence
    } else {
      current = candidate
    }
  }
  if (current.trim()) pieces.push(current.trim())
  return pieces
}
