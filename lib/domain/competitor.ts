export interface CompetitorSummary {
  id: string
  name: string
  website: string | null
  lastReviewedAt: string | null
  sourceCount: number
  healthySourceCount: number
  latestReview: { title: string; snippet: string; createdAt: string } | null
}
