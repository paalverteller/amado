import { createBrandListHandler } from '@/lib/api/brand-scoped-list'

export const GET = createBrandListHandler({
  table: 'brand_claims',
  responseKey: 'claims',
  orderBy: 'created_at',
})
