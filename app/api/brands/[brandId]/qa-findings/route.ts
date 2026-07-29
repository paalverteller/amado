import { createBrandListHandler } from '@/lib/api/brand-scoped-list'

export const GET = createBrandListHandler({
  table: 'qa_findings',
  responseKey: 'findings',
  orderBy: 'created_at',
  ascending: false,
  limit: 100,
})
