import { createBrandListHandler } from '@/lib/api/brand-scoped-list'

export const GET = createBrandListHandler({
  table: 'platform_playbooks',
  responseKey: 'playbooks',
  orderBy: 'platform',
  onlyActive: true,
})
