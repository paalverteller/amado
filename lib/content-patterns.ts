import { getSupabaseAdmin } from '@/lib/supabase/client'

export type HookType = 'question' | 'data' | 'direct_address' | 'command' | 'contrast' | 'statement'
export type CtaType = 'whatsapp' | 'link' | 'comment' | 'share' | 'save' | 'register' | 'demo' | 'learn_more' | 'none'
export type LengthBucket = 'micro' | 'short' | 'medium' | 'long'

export interface PatternArticle {
  id: string
  topic: string
  content_type: string | null
  draft_content: string | null
  final_content: string | null
  char_count: number | null
  brand_profile_id: string | null
  content_request_id?: string | null
  request?: { content_format: string } | { content_format: string }[] | null
}

export interface PatternPillar {
  id: string
  name: string
  purpose: string | null
}

export interface ClassifiedPattern {
  hookType: HookType
  topicKey: string
  ctaType: CtaType
  lengthBucket: LengthBucket
  contentFormat: string
  pillarId: string | null
  pillarName: string | null
  evidence: {
    hook: string
    cta: string
    topic: string[]
    lengthChars: number
    pillarMatchedTerms: string[]
  }
}

const STOPWORDS = new Set([
  'a','o','as','os','de','da','do','das','dos','e','em','no','na','nos','nas','para','por','com','sem','um','uma','uns','umas',
  'que','como','mais','menos','sobre','entre','ao','aos','à','às','se','sua','seu','suas','seus','você','vocês','isso','essa','esse',
  'esta','este','já','não','sim','the','and','for','with','from','into','your','you','how','what','why','when','where',
])

function words(text: string): string[] {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .match(/[a-z0-9]+/g) ?? []
}

function meaningfulWords(text: string): string[] {
  return words(text).filter((w) => w.length >= 3 && !STOPWORDS.has(w))
}

export function detectHookType(text: string): { type: HookType; evidence: string } {
  const opener = text.trim().slice(0, 220)
  const normalized = opener.toLowerCase()
  if (opener.includes('?')) return { type: 'question', evidence: 'primeiros 220 caracteres contêm pergunta' }
  if (/\b\d+(?:[.,]\d+)?%?\b|\br\$\s?\d/i.test(opener)) return { type: 'data', evidence: 'abertura usa número/dado concreto' }
  if (/\b(você|seu|sua|seus|suas)\b/i.test(opener)) return { type: 'direct_address', evidence: 'abertura fala diretamente com “você”' }
  if (/^(descubra|veja|pare|comece|aprenda|imagine|conheça|evite|faça|use|pense)\b/i.test(normalized)) {
    return { type: 'command', evidence: 'abertura começa com verbo no imperativo' }
  }
  if (/\b(mas|porém|enquanto|ao contrário|não é.+é)\b/i.test(normalized)) {
    return { type: 'contrast', evidence: 'abertura usa contraste explícito' }
  }
  return { type: 'statement', evidence: 'abertura declarativa sem marcador dominante' }
}

export function detectCtaType(text: string): { type: CtaType; evidence: string } {
  const tail = text.trim().slice(-500).toLowerCase()
  const checks: Array<[CtaType, RegExp, string]> = [
    ['whatsapp', /whats(?:app)?|chame no zap|mande uma mensagem/, 'menção a WhatsApp/mensagem'],
    ['register', /cadastre-se|cadastro|inscreva-se|inscrição|registre-se/, 'convite para cadastro/inscrição'],
    ['demo', /agende (?:uma )?demo|demonstração|fale com (?:um )?especialista/, 'convite para demo/contato comercial'],
    ['link', /clique|acesse|link na bio|saiba mais no link/, 'convite para abrir link'],
    ['comment', /comente|conte nos comentários|o que você acha|qual a sua opinião/, 'convite para comentar/opinar'],
    ['share', /compartilhe|envie para|marque alguém/, 'convite para compartilhar'],
    ['save', /salve|guarde este post/, 'convite para salvar'],
    ['learn_more', /saiba mais|conheça mais|descubra mais/, 'convite para saber mais'],
  ]
  for (const [type, pattern, evidence] of checks) {
    if (pattern.test(tail)) return { type, evidence }
  }
  return { type: 'none', evidence: 'CTA explícito não detectado nos 500 caracteres finais' }
}

export function detectLengthBucket(chars: number): LengthBucket {
  if (chars <= 300) return 'micro'
  if (chars <= 900) return 'short'
  if (chars <= 1800) return 'medium'
  return 'long'
}

export function extractTopicKey(topic: string): { key: string; terms: string[] } {
  const unique: string[] = []
  for (const w of meaningfulWords(topic)) {
    if (!unique.includes(w)) unique.push(w)
    if (unique.length === 3) break
  }
  const terms = unique.length ? unique : ['geral']
  return { key: terms.join(' · '), terms }
}

export function matchPillar(text: string, pillars: PatternPillar[]): { id: string | null; name: string | null; matched: string[] } {
  const contentWords = new Set(meaningfulWords(text))
  let best: { pillar: PatternPillar; matched: string[]; score: number } | null = null

  for (const pillar of pillars) {
    const candidateTerms = Array.from(new Set(meaningfulWords(`${pillar.name} ${pillar.purpose ?? ''}`)))
    const matched = candidateTerms.filter((w) => contentWords.has(w))
    const score = matched.length / Math.max(Math.min(candidateTerms.length, 8), 1)
    if (matched.length > 0 && (!best || score > best.score || (score === best.score && matched.length > best.matched.length))) {
      best = { pillar, matched, score }
    }
  }

  return best
    ? { id: best.pillar.id, name: best.pillar.name, matched: best.matched.slice(0, 6) }
    : { id: null, name: null, matched: [] }
}

export function classifyContentPattern(article: PatternArticle, pillars: PatternPillar[] = []): ClassifiedPattern {
  const text = (article.final_content || article.draft_content || '').trim()
  const hook = detectHookType(text)
  const cta = detectCtaType(text)
  const topic = extractTopicKey(article.topic)
  const chars = article.char_count ?? text.length
  const pillar = matchPillar(`${article.topic}\n${text}`, pillars)

  return {
    hookType: hook.type,
    topicKey: topic.key,
    ctaType: cta.type,
    lengthBucket: detectLengthBucket(chars),
    contentFormat: (() => {
      const request = Array.isArray(article.request) ? article.request[0] : article.request
      return request?.content_format ?? article.content_type ?? 'unknown'
    })(),
    pillarId: pillar.id,
    pillarName: pillar.name,
    evidence: {
      hook: hook.evidence,
      cta: cta.evidence,
      topic: topic.terms,
      lengthChars: chars,
      pillarMatchedTerms: pillar.matched,
    },
  }
}

export async function recordArticlePattern(articleId: string, platform: string): Promise<void> {
  const admin = getSupabaseAdmin()
  const { data: article, error: articleError } = await admin
    .from('articles')
    .select('id, topic, content_type, draft_content, final_content, char_count, brand_profile_id, content_request_id, request:content_request_id(content_format)')
    .eq('id', articleId)
    .maybeSingle()

  if (articleError || !article?.brand_profile_id) return

  const { data: pillars } = await admin
    .from('brand_content_pillars')
    .select('id, name, purpose')
    .eq('brand_id', article.brand_profile_id)
    .eq('active', true)

  const pattern = classifyContentPattern(article as PatternArticle, (pillars ?? []) as PatternPillar[])
  const payload = {
    article_id: articleId,
    brand_id: article.brand_profile_id,
    platform,
    hook_type: pattern.hookType,
    cta_type: pattern.ctaType,
    topic_key: pattern.topicKey,
    content_format: pattern.contentFormat,
    content_pillar_id: pattern.pillarId,
    length_bucket: pattern.lengthBucket,
    analysis_evidence: pattern.evidence,
  }

  const { data: existing } = await admin
    .from('content_pattern_usage')
    .select('id')
    .eq('article_id', articleId)
    .eq('platform', platform)
    .maybeSingle()

  if (existing?.id) {
    const { error } = await admin.from('content_pattern_usage').update(payload).eq('id', existing.id)
    if (error) console.warn('[content-patterns] update failed:', error.message)
    return
  }

  const { error } = await admin.from('content_pattern_usage').insert(payload)
  if (error) console.warn('[content-patterns] insert failed:', error.message)
}
