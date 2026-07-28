/**
 * Guideline Extraction Agent
 * 
 * Extracts structured brand rules from unstructured guideline documents.
 * Uses AI to parse text/URL content and produce rule candidates for human review.
 * 
 * Design principles:
 * - Source documents are source documents, not mega-prompts
 * - Extracted rules require human approval
 * - Hard rules are deterministic when possible
 * - Versioned extraction with full audit trail
 */

import { generateArticleWithFallback } from '@/lib/ai'

export interface ExtractionInput {
  sourceType: 'brand_book' | 'style_guide' | 'legal_review' | 'competitor_analysis' | 'manual'
  sourceUrl?: string
  sourceText?: string
  brandId: string
}

export interface ExtractedRule {
  ruleType: 'tone' | 'vocabulary' | 'claim' | 'structure' | 'visual' | 'legal' | 'safety'
  scope: 'global' | 'platform' | 'format' | 'campaign'
  scopeTarget?: string
  instruction: string
  precedence: number
  rationale: string
  confidence: 'high' | 'medium' | 'low'
  sourceQuote?: string
  isHardRule: boolean
}

export interface ExtractionResult {
  rules: ExtractedRule[]
  summary: string
  totalCandidates: number
  highConfidenceCount: number
  requiresLegalReview: boolean
  detectedConflicts: Array<{
    ruleA: string
    ruleB: string
    description: string
  }>
}

const EXTRACTION_PROMPT_TEMPLATE = `You are a brand guideline extraction agent. Your task is to analyze the provided guideline document and extract structured, actionable brand rules.

## Input Document
Source type: {{sourceType}}
{{#if sourceUrl}}
URL: {{sourceUrl}}
{{/if}}
{{#if sourceText}}
Content:
---
{{sourceText}}
---
{{/if}}

## Extraction Instructions

Extract rules in the following categories:
1. **tone** - Voice, personality, emotional register
2. **vocabulary** - Preferred, discouraged, forbidden terms
3. **claim** - Approved claims, qualified claims, forbidden claims
4. **structure** - Content structure, formatting requirements
5. **visual** - Visual guidelines, emoji usage, hashtag strategy
6. **legal** - Legal disclaimers, compliance requirements
7. **safety** - Safety warnings, prohibited content

For each rule, provide:
- **ruleType**: One of the categories above
- **scope**: global | platform | format | campaign
- **scopeTarget**: Platform or format name if scoped
- **instruction**: Clear, actionable instruction
- **precedence**: 1-100 (higher = more important)
- **rationale**: Why this rule exists
- **confidence**: high | medium | low
- **sourceQuote**: Exact quote from document supporting this rule
- **isHardRule**: true if this is a deterministic rule (legal, safety, trademark)

## Output Format
Return a JSON object with this structure:
{
  "rules": [
    {
      "ruleType": "tone",
      "scope": "global",
      "instruction": "Use confident but not arrogant tone",
      "precedence": 80,
      "rationale": "Brand positioning emphasizes expertise without pretension",
      "confidence": "high",
      "sourceQuote": "We speak with quiet confidence",
      "isHardRule": false
    }
  ],
  "summary": "Brief summary of what was extracted",
  "requiresLegalReview": false,
  "detectedConflicts": []
}

## Important Rules
- Only extract rules that are explicitly stated or strongly implied
- Mark legal/safety/trademark rules as isHardRule: true
- Flag any conflicting guidance as detectedConflicts
- If confidence is low, still include but mark clearly
- Do not invent rules not present in the document
- Brazilian Portuguese context: ensure rules are culturally appropriate for Brazil`

export async function extractGuidelineRules(
  input: ExtractionInput
): Promise<ExtractionResult> {
  // Build prompt
  const prompt = EXTRACTION_PROMPT_TEMPLATE
    .replace('{{sourceType}}', input.sourceType)
    .replace('{{#if sourceUrl}}', input.sourceUrl ? '' : '{{!}}')
    .replace('{{sourceUrl}}', input.sourceUrl || '')
    .replace('{{/if}}', '')
    .replace('{{#if sourceText}}', input.sourceText ? '' : '{{!}}')
    .replace('{{sourceText}}', input.sourceText || '')
    .replace('{{/if}}', '')

  // Generate extraction
  const response = await generateArticleWithFallback({
    systemPrompt: 'You are a brand guideline extraction agent. Extract structured, actionable brand rules from the provided document.',
    userPrompt: prompt,
    task: 'extraction',
  })

  // Parse JSON response
  let result: ExtractionResult
  try {
    // Try to extract JSON from response (handle markdown code blocks)
    const jsonMatch = response.text.match(/```json\n?([\s\S]*?)\n?```/) || 
                      response.text.match(/\{[\s\S]*\}/)
    const jsonStr = jsonMatch ? jsonMatch[1] || jsonMatch[0] : response.text
    result = JSON.parse(jsonStr)
  } catch (parseError) {
    console.error('Failed to parse extraction result:', parseError)
    console.error('Raw response:', response.text)
    throw new Error('Failed to parse guideline extraction result')
  }

  // Validate and normalize
  result.rules = result.rules || []
  result.detectedConflicts = result.detectedConflicts || []
  result.totalCandidates = result.rules.length
  result.highConfidenceCount = result.rules.filter(r => r.confidence === 'high').length

  return result
}

export function categorizeRulesByType(rules: ExtractedRule[]): Record<string, ExtractedRule[]> {
  return rules.reduce((acc, rule) => {
    if (!acc[rule.ruleType]) acc[rule.ruleType] = []
    acc[rule.ruleType].push(rule)
    return acc
  }, {} as Record<string, ExtractedRule[]>)
}

export function filterHardRules(rules: ExtractedRule[]): ExtractedRule[] {
  return rules.filter(r => r.isHardRule)
}

export function calculateExtractionStats(result: ExtractionResult) {
  const byType = categorizeRulesByType(result.rules)
  const hardRules = filterHardRules(result.rules)
  
  return {
    total: result.totalCandidates,
    highConfidence: result.highConfidenceCount,
    mediumConfidence: result.rules.filter(r => r.confidence === 'medium').length,
    lowConfidence: result.rules.filter(r => r.confidence === 'low').length,
    hardRules: hardRules.length,
    byType: Object.fromEntries(
      Object.entries(byType).map(([k, v]) => [k, v.length])
    ),
    requiresLegalReview: result.requiresLegalReview,
    conflicts: result.detectedConflicts.length,
  }
}
