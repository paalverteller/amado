/**
 * Amado — Canonical Content Format Registry
 * 
 * Single source of truth for all content formats across the application.
 * No database CHECK constraints — validated at application layer.
 * 
 * §2.1 from product spec: one canonical content format registry.
 */

export const CONTENT_FORMATS = [
  'article',
  'linkedin_post',
  'instagram_caption',
  'instagram_carousel',
  'x_thread',
  'threads_post',
  'facebook_post',
  'telegram_post',
  'short_video_script',
  'email',
  'quick_note',
  'rewrite',
] as const

export type ContentFormat = (typeof CONTENT_FORMATS)[number]

export function isValidContentFormat(format: string): format is ContentFormat {
  return CONTENT_FORMATS.includes(format as ContentFormat)
}

export function assertValidContentFormat(format: string): ContentFormat {
  if (!isValidContentFormat(format)) {
    throw new Error(`Invalid content format: "${format}". Valid formats: ${CONTENT_FORMATS.join(', ')}`)
  }
  return format
}

// ─── Format Categories ──────────────────────────────────────────────────────

/** Short-form social posts (≤ 600 chars typical) */
export const SHORT_FORMATS = new Set<ContentFormat>([
  'linkedin_post',
  'instagram_caption',
  'threads_post',
  'facebook_post',
  'telegram_post',
  'quick_note',
])

/** Segmented/multi-part formats */
export const SEGMENTED_FORMATS = new Set<ContentFormat>([
  'x_thread',
  'instagram_carousel',
])

/** Long-form editorial */
export const LONG_FORMATS = new Set<ContentFormat>([
  'article',
  'email',
])

/** Video/audio formats */
export const VIDEO_FORMATS = new Set<ContentFormat>([
  'short_video_script',
])

export function isShortFormat(format: string): boolean {
  return SHORT_FORMATS.has(format as ContentFormat)
}

export function isSegmentedFormat(format: string): boolean {
  return SEGMENTED_FORMATS.has(format as ContentFormat)
}

export function isLongFormat(format: string): boolean {
  return LONG_FORMATS.has(format as ContentFormat)
}

export function isVideoFormat(format: string): boolean {
  return VIDEO_FORMATS.has(format as ContentFormat)
}

// ─── Format Metadata ────────────────────────────────────────────────────────

export interface FormatMeta {
  label: string
  labelPtBr: string
  maxChars: number | null
  maxWords: number | null
  platform: string | null
  category: 'short' | 'segmented' | 'long' | 'video' | 'other'
  supportsSeo: boolean
  supportsCarousel: boolean
}

export const FORMAT_METADATA: Record<ContentFormat, FormatMeta> = {
  article: {
    label: 'Article',
    labelPtBr: 'Artigo',
    maxChars: null,
    maxWords: null,
    platform: null,
    category: 'long',
    supportsSeo: true,
    supportsCarousel: false,
  },
  linkedin_post: {
    label: 'LinkedIn Post',
    labelPtBr: 'Post LinkedIn',
    maxChars: 3000,
    maxWords: null,
    platform: 'linkedin',
    category: 'short',
    supportsSeo: false,
    supportsCarousel: true,
  },
  instagram_caption: {
    label: 'Instagram Caption',
    labelPtBr: 'Legenda Instagram',
    maxChars: 2200,
    maxWords: null,
    platform: 'instagram',
    category: 'short',
    supportsSeo: false,
    supportsCarousel: false,
  },
  instagram_carousel: {
    label: 'Instagram Carousel',
    labelPtBr: 'Carrossel Instagram',
    maxChars: null,
    maxWords: null,
    platform: 'instagram',
    category: 'segmented',
    supportsSeo: false,
    supportsCarousel: true,
  },
  x_thread: {
    label: 'X / Threads',
    labelPtBr: 'Thread X',
    maxChars: 280,
    maxWords: null,
    platform: 'x',
    category: 'segmented',
    supportsSeo: false,
    supportsCarousel: false,
  },
  threads_post: {
    label: 'Threads Post',
    labelPtBr: 'Post Threads',
    maxChars: 500,
    maxWords: null,
    platform: 'threads',
    category: 'short',
    supportsSeo: false,
    supportsCarousel: false,
  },
  facebook_post: {
    label: 'Facebook Post',
    labelPtBr: 'Post Facebook',
    maxChars: 63206,
    maxWords: null,
    platform: 'facebook',
    category: 'short',
    supportsSeo: false,
    supportsCarousel: false,
  },
  telegram_post: {
    label: 'Telegram Post',
    labelPtBr: 'Post Telegram',
    maxChars: 4096,
    maxWords: null,
    platform: 'telegram',
    category: 'short',
    supportsSeo: false,
    supportsCarousel: false,
  },
  short_video_script: {
    label: 'Short Video Script',
    labelPtBr: 'Roteiro Vídeo Curto',
    maxChars: null,
    maxWords: null,
    platform: null,
    category: 'video',
    supportsSeo: false,
    supportsCarousel: false,
  },
  email: {
    label: 'Email',
    labelPtBr: 'Email',
    maxChars: null,
    maxWords: null,
    platform: null,
    category: 'long',
    supportsSeo: true,
    supportsCarousel: false,
  },
  quick_note: {
    label: 'Quick Note',
    labelPtBr: 'Nota Rápida',
    maxChars: 1200,
    maxWords: null,
    platform: null,
    category: 'short',
    supportsSeo: false,
    supportsCarousel: false,
  },
  rewrite: {
    label: 'Rewrite',
    labelPtBr: 'Reescrita',
    maxChars: null,
    maxWords: null,
    platform: null,
    category: 'other',
    supportsSeo: false,
    supportsCarousel: false,
  },
}

export function getFormatMeta(format: string): FormatMeta | null {
  if (!isValidContentFormat(format)) return null
  return FORMAT_METADATA[format]
}

export function getFormatLabel(format: string, locale: 'en' | 'pt-BR' = 'pt-BR'): string {
  const meta = getFormatMeta(format)
  if (!meta) return format
  return locale === 'pt-BR' ? meta.labelPtBr : meta.label
}

// ─── Legacy Mapping (for backward compatibility during migration) ───────────

/** Map legacy content types to canonical formats */
export function mapLegacyContentType(legacy: string): ContentFormat {
  const mapping: Record<string, ContentFormat> = {
    'article': 'article',
    'post': 'linkedin_post',
    'concept': 'article',
    'blog_post': 'article',
    'note': 'quick_note',
    'social_post': 'linkedin_post',
    'thread': 'x_thread',
    'carousel': 'instagram_carousel',
    'telegram_post': 'telegram_post',
    'case_review': 'article',
    'article_comment': 'quick_note',
  }
  return mapping[legacy] ?? 'article'
}

/** Reverse: canonical to legacy (for dual-write during migration) */
export function mapToLegacyContentType(format: ContentFormat): string {
  const mapping: Record<ContentFormat, string> = {
    'article': 'article',
    'linkedin_post': 'social_post',
    'instagram_caption': 'social_post',
    'instagram_carousel': 'carousel',
    'x_thread': 'thread',
    'threads_post': 'social_post',
    'facebook_post': 'social_post',
    'telegram_post': 'telegram_post',
    'short_video_script': 'article',
    'email': 'article',
    'quick_note': 'note',
    'rewrite': 'article',
  }
  return mapping[format] ?? 'article'
}
