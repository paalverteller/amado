import { createBrandListHandler } from '@/lib/api/brand-scoped-list'

export const GET = createBrandListHandler({
  table: 'brand_audiences',
  responseKey: 'audiences',
  orderBy: 'created_at',
  onlyActive: true,
})
