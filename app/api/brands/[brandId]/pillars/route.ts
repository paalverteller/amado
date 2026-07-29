import { createBrandListHandler } from '@/lib/api/brand-scoped-list'

export const GET = createBrandListHandler({
  table: 'brand_content_pillars',
  responseKey: 'pillars',
  orderBy: 'sort_order',
  onlyActive: true,
})
