import { NextRequest, NextResponse } from 'next/server'
import { scrapeUrl } from '@/lib/firecrawl'

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json() as { url?: string }
    const url = body.url?.trim()

   if (!url) {
      return NextResponse.json({ error: 'URL é obrigatório' }, { status: 400 })
   }

    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      return NextResponse.json({ error: 'URL deve começar com http:// ou https://' }, { status: 400 })
   }

    const result = await scrapeUrl(url)

    if (!result.content || result.content.length < 100) {
      return NextResponse.json(
        { error: 'A página não contém texto suficiente para extração' },
        { status: 422 },
      )
    }

    return NextResponse.json({
      title:   result.title,
      content: result.content,
      url:     result.url,
      source:  result.source,
      chars:   result.content.length,
    })
  } catch (error) {
    const err = error as Error
    console.error('[scrape] error:', err.message)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
