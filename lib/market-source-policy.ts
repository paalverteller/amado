/**
 * General-market evidence policy.
 *
 * Keep material that can affect SaaS buyers and businesses. Exclude
 * political competition/elections, geopolitical conflict, sport,
 * entertainment and competitor-monitoring items from the general market
 * intelligence pipeline.
 *
 * Regulation, tax, privacy, labour and macroeconomic coverage remains
 * eligible when it has genuine business relevance.
 */

export interface MarketEvidencePolicyInput {
  sourceCategory?: string | null
  title?: string | null
  summary?: string | null
}

const BLOCKED_CATEGORIES = new Set([
  'politics',
  'political',
  'sport',
  'sports',
  'entertainment',
  'celebrity',
  'culture',
  'competitor',
])

const BLOCKED_PATTERNS: RegExp[] = [
  // Elections / party politics — English.
  /\b(election|electoral|campaign trail|presidential race|political party|democratic party|republican party)\b/i,
  /\b(trump|biden|harris)\b/i,

  // Portuguese.
  /\b(eleição|eleições|eleitoral|campanha eleitoral|partido político|presidencial|congresso nacional|câmara dos deputados|senado federal)\b/i,
  /\b(lula|bolsonaro)\b/i,

  // Spanish.
  /\b(elección|elecciones|electoral|campaña electoral|partido político|presidencial|congreso de los diputados|senado español)\b/i,
  /\b(pedro sánchez|feijóo)\b/i,

  // German.
  /\b(wahlkampf|bundestagswahl|politische partei|bundeskanzler|bundestag)\b/i,
  /\b(friedrich merz)\b/i,

  // Geopolitical / military news.
  /\b(war|military strike|armed conflict|ceasefire|geopolitic)\b/i,
  /\b(guerra|ataque militar|conflito armado|geopolític)\b/i,
  /\b(conflicto armado|ataque militar|geopolític)\b/i,
  /\b(krieg|militärangriff|bewaffneter konflikt|geopolit)\b/i,

  // Sport.
  /\b(football|soccer|nba|nfl|mlb|nhl|champions league|world cup|grand prix|formula 1|olympic|tennis tournament)\b/i,
  /\b(futebol|brasileirão|libertadores|copa do mundo|fórmula 1|olimpíad|torneio de tênis)\b/i,
  /\b(fútbol|la liga|mundial de fútbol|fórmula 1|olímpic|torneo de tenis)\b/i,
  /\b(fußball|bundesliga|weltmeisterschaft|formel 1|olympi|tennisturnier)\b/i,

  // Entertainment / celebrity noise.
  /\b(celebrity|box office|movie premiere|music awards|reality show)\b/i,
  /\b(celebridade|bilheteria|estreia de filme|reality show)\b/i,
  /\b(celebridad|taquilla|estreno de película|reality show)\b/i,
  /\b(promi|kinocharts|filmpremiere|realityshow)\b/i,
]

export function isMarketEvidenceEligible(input: MarketEvidencePolicyInput): boolean {
  const category = (input.sourceCategory ?? '').trim().toLowerCase()
  if (category && BLOCKED_CATEGORIES.has(category)) return false

  const text = `${input.title ?? ''}\n${input.summary ?? ''}`.trim()
  if (!text) return true

  return !BLOCKED_PATTERNS.some((pattern) => pattern.test(text))
}
