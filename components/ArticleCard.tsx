'use client'

import Link from 'next/link'
import { Article } from '@/lib/domain/article'
function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR', { day: 'numeric', month: 'long' })
}

function safeText(value: string | null | undefined): string {
  return value?.trim() || 'Sem tema'
}

/**
 * Splits article content into { title, firstParagraph }.
 * Content is plain text; the model is instructed to put the headline
 * on the first line, followed by a blank line, then body paragraphs.
 */
function splitContent(article: Article): { title: string; firstParagraph: string } {
  const raw = stripForParagraphs(article.final_content ?? article.draft_content ?? '')

  if (!raw) {
    return { title: safeText(article.topic), firstParagraph: '' }
  }

  const parts = raw.split(/\n\s*\n/).map(p => p.trim()).filter(Boolean)

  if (parts.length === 0) {
    return { title: safeText(article.topic), firstParagraph: '' }
  }

  // If the first block looks like a title (short, no sentence-ending punctuation
  // mid-way, under ~120 chars), treat it as the headline and the next block as
  // the opening paragraph. Otherwise, use the article topic as title and the
  // first block as the opening paragraph.
  const firstBlock = parts[0]
  const looksLikeTitle = firstBlock.length <= 140 && parts.length > 1

  if (looksLikeTitle) {
    return { title: firstBlock, firstParagraph: parts[1] ?? '' }
  }

  return { title: safeText(article.topic), firstParagraph: firstBlock }
}

// Preserve paragraph breaks (double newline) but collapse other whitespace
function stripForParagraphs(text: string): string {
  return text
    .split(/\n\s*\n/)
    .map(block => block.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .join('\n\n')
}

export default function ArticleCard({ article }: { article: Article }) {
  const { title, firstParagraph } = splitContent(article)

  return (
    <Link
      prefetch={false}
      href={`/history/${article.id}`}
      className="block h-full w-full min-w-0 max-w-full overflow-hidden no-underline outline-none"
      style={{ overflowWrap: 'anywhere', wordBreak: 'break-word' }}
    >
      <article
        className="m3-card group flex h-full w-full min-w-0 max-w-full cursor-pointer flex-col overflow-hidden p-5"
        style={{ overflowWrap: 'anywhere', wordBreak: 'break-word', contain: 'layout paint' }}
      >
        <h3
          className="m-0 min-w-0 max-w-full overflow-hidden text-[16px] font-bold leading-snug text-on-surface transition-colors duration-200 group-hover:text-primary"
          style={{
            display: '-webkit-box',
            WebkitLineClamp: 3,
            WebkitBoxOrient: 'vertical',
            overflowWrap: 'anywhere',
            wordBreak: 'break-word',
            fontFamily: 'var(--font-display)',
          }}
        >
          {title}
        </h3>

        {firstParagraph && (
          <p
            className="m-0 mt-2.5 min-w-0 max-w-full overflow-hidden text-[14px] leading-relaxed"
            style={{
              display: '-webkit-box',
              WebkitLineClamp: 5,
              WebkitBoxOrient: 'vertical',
              overflowWrap: 'anywhere',
              wordBreak: 'break-word',
              color: 'var(--color-on-surface-variant)',
            }}
          >
            {firstParagraph}
          </p>
        )}

        <div className="mt-3 flex items-center justify-between">
          <span className="text-xs font-medium text-on-surface-variant/70">
            {formatDate(article.created_at)}
          </span>

          {article.rating !== null ? (
            <div className="flex shrink-0 gap-0.5 text-sm" aria-label={`Avaliação: ${article.rating} de 5`}>
              {[1, 2, 3, 4, 5].map((i) => (
                <span key={i} className={i <= (article.rating ?? 0) ? 'text-[#e5b513]' : 'text-surface-variant'}>
                  ★
                </span>
              ))}
            </div>
          ) : null}
        </div>
      </article>
    </Link>
  )
}
