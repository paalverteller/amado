# Amado

Amado is an AI-first marketing workspace for teams that research markets, manage Brand OS, generate localized content, track competitors and turn market evidence into marketing actions.

## Current product contract

- Interface language: Russian only.
- Supported markets: Brazil (`pt-BR`), Spain (`es-ES`), Germany (`de-DE`), United States (`en-US`).
- Generated content, localization, rewrite and market-analysis language follow the selected market.
- Brand OS is market-specific.
- Social content uses platform-specific Brand OS playbooks.
- General market intelligence excludes politics, elections, sport and entertainment noise.
- Competitor monitoring is a separate evidence workflow and is not filtered out at ingestion.
- Production deployment: Vercel.
- Database: Supabase/Postgres with pgvector.

## Stack

- Next.js 16 App Router
- React 19
- TypeScript
- Tailwind CSS 4
- Supabase
- Vercel AI SDK 6
- Google Gemini with provider fallbacks
- Vitest
- Playwright

## Main workspaces

- `/overview` — marketer control center
- `/market` — market signals
- `/market/analysis` — evidence-grounded deep market analysis
- `/generate` — canonical content generation
- `/generate/seo` — grounded SEO article generation
- `/localize` — market-aware localization
- `/rewrite` — market-aware rewriting
- `/knowledge` — knowledge base / RAG
- `/brand` — Brand OS
- `/competitors` — competitor monitoring
- `/analytics` — content performance analytics
- `/history` — generated content history
- `/settings` — sources and prompt library

## Market model

The top-right market selector is a product-wide context, not a UI-language selector.

| Market | Locale | Currency | Time zone |
| --- | --- | --- | --- |
| Brazil | `pt-BR` | BRL | America/Sao_Paulo |
| Spain | `es-ES` | EUR | Europe/Madrid |
| Germany | `de-DE` | EUR | Europe/Berlin |
| United States | `en-US` | USD | America/New_York |

The interface remains Russian in every market.

## Content generation

The canonical pipeline is `lib/content-generation/generate-article.ts`.

Generation combines:

1. selected market / locale;
2. Brand OS snapshot;
3. active platform playbook for social formats;
4. Knowledge/RAG context;
5. region-aware market evidence;
6. competitor context when relevant;
7. prompt template;
8. output-format contract.

Social formats currently include LinkedIn, Instagram caption, Instagram carousel, Facebook, X thread and Threads.

Social generation follows permanent rules:

- truth over speed;
- business outcomes over vanity engagement;
- platform-native adaptation over literal cross-posting;
- original evidence over generic AI prose;
- conversation only when useful;
- human review for high-risk claims.

## Market intelligence

General market evidence is filtered through `lib/market-source-policy.ts`.

The market pipeline intentionally excludes:

- electoral and party politics;
- geopolitical conflict;
- sport;
- entertainment / celebrity noise;
- competitor-tagged evidence from the general market feed.

Business-relevant regulation, privacy, taxation, labour and macroeconomic coverage may remain eligible.

Region filtering is applied when automatic evidence is selected for generation.

## Brand OS

Brand OS combines:

- core brand profile;
- audiences and pain points;
- products and claims;
- voice and vocabulary;
- content pillars;
- approved examples;
- compliance rules;
- platform playbooks;
- versioned rule sets.

`platform_playbooks` is the canonical store for platform strategy and measurement rules. Active playbooks are injected into social-generation prompts.

## Database workflow

Production Supabase was established from a manually consolidated baseline.

Do not use historical `supabase db push` merely to install additive seeds.

For additive production data changes:

1. review the SQL;
2. run it in Supabase SQL Editor;
3. run the SQL verification query;
4. keep schema/code changes in Git.

Historical migrations remain in `supabase/migrations/`; archived pre-numbered migrations remain in `supabase/migrations_archive/legacy/` for reference.

## Verification

Required before pushing code:

```bash
npm test
npm run build
node scripts/verify-august-ui.mjs
git diff --check
```

Use additional sprint-specific verifiers when the affected feature has one.

Current important verifiers include:

- `scripts/verify-amado-chain.mjs`
- `scripts/verify-august-ui.mjs`
- `scripts/verify-final-workspaces.mjs`
- `scripts/verify-mvp-runtime.mjs`
- `scripts/verify-multimarket-localization.mjs`
- `scripts/verify-social-source-sprint.mjs`

## Development rules

- Read `AGENTS.md` before modifying Next.js code.
- Next.js 16 uses `proxy.ts`; do not introduce `middleware.ts`.
- Make surgical changes.
- Do not refactor unrelated working flows.
- Keep code, comments, identifiers and commit messages in English.
- Treat verification as part of implementation, not as an optional final step.
- Prefer one consolidated patch per task.
- Never leave one-off root patch scripts in the repository.

## Environment

Required production configuration includes Supabase credentials, `ACCESS_PASSWORD`, `CRON_SECRET`, and at least one configured AI provider.

Google AI Studio accepts both:

- `GEMINI_API_KEY`
- `GOOGLE_GENERATIVE_AI_API_KEY`

See `lib/amado-config.ts`, `lib/ai-utils.ts` and `lib/ai.ts` for current runtime configuration and fallback behavior.

## Documentation

- `README.md` — current product and engineering contract
- `HANDOFF.md` — concise cross-session operational handoff
- `docs/AMADO_ROADMAP.md` — current roadmap and completed foundations
- `docs/SCHEMA.md` — current schema map
- `CLAUDE.md` — repository working rules
- `AGENTS.md` — Next.js-specific agent rule
