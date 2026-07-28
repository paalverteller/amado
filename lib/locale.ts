/**
 * Amado — Localization Helpers
 * 
 * §14.1 from product spec: locale service for dates, times, numbers, currency.
 * Brazil-first, extensible for future regions.
 */

export const DEFAULT_LOCALE = 'pt-BR'
export const DEFAULT_CURRENCY = 'BRL'
export const DEFAULT_TIMEZONE = 'America/Sao_Paulo'

// ─── Date/Time Formatting ───────────────────────────────────────────────────

export function formatDate(date: Date | string | number, locale: string = DEFAULT_LOCALE): string {
  const d = typeof date === 'string' || typeof date === 'number' ? new Date(date) : date
  return d.toLocaleDateString(locale, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

export function formatDateShort(date: Date | string | number, locale: string = DEFAULT_LOCALE): string {
  const d = typeof date === 'string' || typeof date === 'number' ? new Date(date) : date
  return d.toLocaleDateString(locale, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

export function formatTime(date: Date | string | number, locale: string = DEFAULT_LOCALE): string {
  const d = typeof date === 'string' || typeof date === 'number' ? new Date(date) : date
  return d.toLocaleTimeString(locale, {
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function formatDateTime(date: Date | string | number, locale: string = DEFAULT_LOCALE): string {
  return `${formatDateShort(date, locale)} ${formatTime(date, locale)}`
}

export function formatRelativeTime(date: Date | string | number, locale: string = DEFAULT_LOCALE): string {
  const d = typeof date === 'string' || typeof date === 'number' ? new Date(date) : date
  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const diffSec = Math.floor(diffMs / 1000)
  const diffMin = Math.floor(diffSec / 60)
  const diffHour = Math.floor(diffMin / 60)
  const diffDay = Math.floor(diffHour / 24)

  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' })
  
  if (diffSec < 60) return rtf.format(-diffSec, 'second')
  if (diffMin < 60) return rtf.format(-diffMin, 'minute')
  if (diffHour < 24) return rtf.format(-diffHour, 'hour')
  if (diffDay < 30) return rtf.format(-diffDay, 'day')
  if (diffDay < 365) return rtf.format(-Math.floor(diffDay / 30), 'month')
  return rtf.format(-Math.floor(diffDay / 365), 'year')
}

// ─── Number Formatting ──────────────────────────────────────────────────────

export function formatNumber(num: number, locale: string = DEFAULT_LOCALE): string {
  return new Intl.NumberFormat(locale).format(num)
}

export function formatPercent(num: number, locale: string = DEFAULT_LOCALE): string {
  return new Intl.NumberFormat(locale, { style: 'percent', minimumFractionDigits: 1 }).format(num)
}

export function formatCurrency(
  amount: number,
  currency: string = DEFAULT_CURRENCY,
  locale: string = DEFAULT_LOCALE,
): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
  }).format(amount)
}

// ─── Brazil-Specific Helpers ────────────────────────────────────────────────

/** Format Brazilian CPF/CNPJ (placeholder for future use) */
export function formatCpfCnpj(value: string): string {
  const digits = value.replace(/\D/g, '')
  if (digits.length === 11) {
    return digits.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')
  }
  if (digits.length === 14) {
    return digits.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5')
  }
  return value
}

/** Format Brazilian phone number */
export function formatPhoneBR(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  if (digits.length === 11) {
    return digits.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3')
  }
  if (digits.length === 10) {
    return digits.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3')
  }
  return phone
}

// ─── Content Validation ─────────────────────────────────────────────────────

/** Check if text contains European Portuguese markers (vs Brazilian) */
export function hasEuropeanPortugueseMarkers(text: string): boolean {
  const euPtMarkers = [
    /\b(?:telemóvel)\b/i,  // BR: celular
    /\b(?:comboio)\b/i,    // BR: trem
    /\b(?:autocarro)\b/i,  // BR: ônibus
    /\b(?:fixe)\b/i,       // BR: legal/bacana
  ]
  return euPtMarkers.some((re) => re.test(text))
}

/** Basic check for pt-BR naturalness (not a full NLP solution) */
export function looksLikePtBr(text: string): boolean {
  // Must have Portuguese-like words
  const ptWords = /\b(?:você|vocês|nós|eles|elas|estamos|temos|fazemos|vamos|que|como|quando|onde|porque|mas|então|agora|aqui|hoje|muito|mais|bem|já|ainda|sempre|nunca|talvez|porém|contudo|entretanto|portanto|assim|desse|desde|entre|sobre|sob|para|por|com|sem|em|na|no|nas|nos|da|do|das|dos)\b/i
  if (!ptWords.test(text)) return false
  
  // Should not have strong European Portuguese markers
  if (hasEuropeanPortugueseMarkers(text)) return false
  
  return true
}
