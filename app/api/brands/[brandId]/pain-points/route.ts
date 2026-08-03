import { createBrandListHandler } from '@/lib/api/brand-scoped-list'

export const GET = createBrandListHandler({
  table: 'brand_pain_points',
  responseKey: 'painPoints',
  orderBy: 'sort_order',
  onlyActive: true,
})
