// Firecrawl integration for scraping web articles into clean text.
// Falls back to native fetch + basic HTML stripping if no API key is set.

const FIRECRAWL_API = 'https://api.firecrawl.dev/v1/scrape'
const TIMEOUT_MS = 15000

interface FirecrawlResponse {
  success: boolean
  data?: {
    markdown?: string
    content?: string
    metadata?: {
      title?: string
      description?: string
      sourceURL?: string
    }
  }
  error?: string
}

export interface ScrapeResult {
  title: string
  content: string  // clean plain text, no markdown
  url: string
  source: 'firecrawl' | 'native'
}

// Strip common HTML tags and collapse whitespace
function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/\s{2,}/g, ' ')
    .trim()
}

// Strip markdown formatting to plain text
function stripMarkdown(md: string): string {
  return md
    .replace(/^#{1,6}\s+/gm, '')       // headings
    .replace(/\*\*(.+?)\*\*/g, '$1')    // bold
    .replace(/\*(.+?)\*/g, '$1')        // italic
    .replace(/`{1,3}[\s\S]*?`{1,3}/g, '') // code
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // links
    .replace(/^[-*+]\s+/gm, '')          // bullets
    .replace(/^\d+\.\s+/gm, '')          // numbered lists
    .replace(/^>{1,}\s*/gm, '')          // blockquotes
    .replace(/---+/g, '')                // hr
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

async function scrapeWithFirecrawl(url: string, apiKey: string): Promise<ScrapeResult> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)

  try {
    const res = await fetch(FIRECRAWL_API, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        url,
        formats: ['markdown'],
        onlyMainContent: true,
      }),
      signal: controller.signal,
    })

    if (!res.ok) {
      const errText = await res.text()
      throw new Error(`Firecrawl ${res.status}: ${errText.slice(0, 200)}`)
    }

    const data = await res.json() as FirecrawlResponse

    if (!data.success || !data.data) {
      throw new Error(data.error ?? 'Firecrawl returned no data')
    }

    const raw = data.data.markdown ?? data.data.content ?? ''
    const content = stripMarkdown(raw).slice(0, 50000) // cap at 50k chars

    return {
      title: data.data.metadata?.title ?? url,
      content,
      url,
      source: 'firecrawl',
    }
  } finally {
    clearTimeout(timer)
  }
}

async function scrapeNative(url: string): Promise<ScrapeResult> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)

  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; ContentFactory/1.0)' },
      signal: controller.signal,
    })

    if (!res.ok) {
      throw new Error(`HTTP ${res.status} fetching ${url}`)
    }

    const html = await res.text()
    const content = stripHtml(html).slice(0, 50000)

    // Extract title from <title> tag
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i)
    const title = titleMatch ? titleMatch[1].trim() : url

    return { title, content, url, source: 'native' }
  } finally {
    clearTimeout(timer)
  }
}

export async function scrapeUrl(url: string): Promise<ScrapeResult> {
  const apiKey = process.env.FIRECRAWL_API_KEY

  if (apiKey) {
    try {
      return await scrapeWithFirecrawl(url, apiKey)
    } catch (err) {
      console.error('[firecrawl] primary failed, falling back to native:', (err as Error).message)
    }
  }

  return scrapeNative(url)
}
