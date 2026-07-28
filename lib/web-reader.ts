const READER_TIMEOUT_MS = 12_000

type ReaderMode = 'off' | 'free' | 'key'

function readerMode(): ReaderMode {
  const raw = (process.env.JINA_READER_MODE ?? process.env.ENABLE_JINA_READER ?? 'off').toLowerCase()

  if (raw === 'true' || raw === 'key') return 'key'
  if (raw === 'free') return 'free'
  return 'off'
}

async function fetchWithTimeout(url: string, init?: RequestInit): Promise<Response> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), READER_TIMEOUT_MS)

  try {
    return await fetch(url, { ...init, signal: controller.signal })
  } finally {
    clearTimeout(timeout)
  }
}

function stripMarkdownNoise(value: string): string {
  return value
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]+/g, ' ')
    .trim()
}

async function readWithFirecrawl(url: string): Promise<string | null> {
  const firecrawlKey = process.env.FIRECRAWL_API_KEY
  if (!firecrawlKey) return null

  try {
    const response = await fetchWithTimeout('https://api.firecrawl.dev/v2/scrape', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${firecrawlKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url,
        formats: ['markdown'],
        onlyMainContent: true,
        timeout: READER_TIMEOUT_MS,
      }),
    })

    if (!response.ok) {
      console.warn(`[reader] Firecrawl failed ${response.status} for ${url}`)
      return null
    }

    const data = await response.json() as {
      data?: { markdown?: string }
      markdown?: string
    }

    const text = data.data?.markdown ?? data.markdown
    if (text && text.trim().length > 100) {
      return stripMarkdownNoise(text)
    }
  } catch (error) {
    console.warn('[reader] Firecrawl exception:', error)
  }

  return null
}

async function readWithJina(url: string): Promise<string | null> {
  const mode = readerMode()
  if (mode === 'off') return null

  try {
    const headers: Record<string, string> = {
      Accept: 'text/plain',
      'x-respond-with': 'readerlm-v2',
    }

    // free mode intentionally does not spend the API-key quota.
    // key mode uses JINA_API_KEY if available.
    if (mode === 'key' && process.env.JINA_API_KEY) {
      headers.Authorization = `Bearer ${process.env.JINA_API_KEY}`
    }

    const response = await fetchWithTimeout(`https://r.jina.ai/${url}`, { headers })

    if (!response.ok) {
      console.warn(`[reader] Jina ${mode} failed ${response.status} for ${url}`)
      return null
    }

    const text = await response.text()
    if (text.trim().length > 100) {
      return stripMarkdownNoise(text)
    }
  } catch (error) {
    console.warn('[reader] Jina exception:', error)
  }

  return null
}

export async function readUrlAsText(url: string): Promise<string | null> {
  // Free-tier friendly order:
  // 1. Firecrawl if FIRECRAWL_API_KEY is configured.
  // 2. Jina only if explicitly enabled:
  //    - JINA_READER_MODE=free -> no API key, lower public limits
  //    - JINA_READER_MODE=key  -> uses JINA_API_KEY
  // 3. Otherwise return null and let lib/rss.ts use its local HTML parser.
  const firecrawlText = await readWithFirecrawl(url)
  if (firecrawlText) return firecrawlText

  const jinaText = await readWithJina(url)
  if (jinaText) return jinaText

  return null
}
