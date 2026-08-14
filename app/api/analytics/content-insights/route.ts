import { NextRequest, NextResponse } from 'next/server'
import { loadMarketingInsights } from '@/lib/marketing-analytics'
import { getErrorMessage } from '@/lib/api/error-message'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const brandId = request.nextUrl.searchParams.get('brand_id')
    const insights = await loadMarketingInsights(brandId)
    return NextResponse.json(insights)
  } catch (error) {
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 })
  }
}
