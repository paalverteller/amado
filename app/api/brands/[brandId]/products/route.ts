import { createBrandListHandler } from '@/lib/api/brand-scoped-list'

export const GET = createBrandListHandler({
  table: 'brand_products',
  responseKey: 'products',
  orderBy: 'created_at',
  onlyActive: true,
})
