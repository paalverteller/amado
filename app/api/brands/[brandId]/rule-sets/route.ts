import { createBrandListHandler } from '@/lib/api/brand-scoped-list'

export const GET = createBrandListHandler({
  table: 'brand_rule_sets',
  responseKey: 'ruleSets',
  orderBy: 'created_at',
  ascending: false,
})
