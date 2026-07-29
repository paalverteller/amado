import { createBrandListHandler } from '@/lib/api/brand-scoped-list'

export const GET = createBrandListHandler({
  table: 'brand_terms',
  responseKey: 'terms',
  orderBy: 'term',
  onlyActive: true,
})
