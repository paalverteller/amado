# Amado — handoff

Last consolidated: 2026-08-24.

Read `README.md` first. This file contains only the state and constraints that matter when continuing work.

## Product

Amado is an AI-first marketing workspace.

The current product has four active market contexts:

- BR — Brazilian Portuguese
- ES — Spanish for Spain
- DE — German for Germany
- US — US English

The UI is always Russian. Market selection changes content language, market evidence, Brand OS context and market-aware AI prompts.

Do not mix UI locale with market locale.

## Current architecture

### Frontend

Next.js 16 App Router + React 19.

The canonical UI system is August:

- dark desktop sidebar;
- responsive PWA navigation;
- Inter-only typography;
- August semantic tokens in `app/globals.css`;
- standard feedback via `components/ui/AugustFeedback.tsx`;
- standard dialogs via `components/ui/AugustDialog.tsx`.

Do not reintroduce legacy visual systems.

Next.js 16 uses `proxy.ts`. Never create `middleware.ts` in parallel.

### Market context

`lib/market-context.tsx` is the client market context.

`lib/locale.ts` contains static region locale metadata.

Region data also exists in Supabase `regions`.

The market switcher is product-wide. Brand, generation, localization, rewrite, competitors, SEO and market analysis should follow the selected region.

### Generation

Canonical generation entry:

`lib/content-generation/generate-article.ts`

Important dependencies:

- `lib/prompts.ts`
- `lib/brand-snapshot.ts`
- `lib/evidence.ts`
- `lib/social-generation-policy.ts`
- Knowledge/RAG repositories
- article/content-request repositories

Automatic recent evidence must be region-aware.

### Social content

The social-media brief dated 2026-08-24 is integrated as executable Brand OS playbooks.

Supported social formats:

- LinkedIn
- Instagram caption
- Instagram carousel
- Facebook
- X thread
- Threads

`platform_playbooks` contains platform strategy + measurement rules.

`lib/social-generation-policy.ts` adds the permanent social execution contract and active playbook to canonical generation.

Do not hardcode Brazil-specific social guidance into generic prompt code.

### Market evidence

`lib/market-source-policy.ts` is the shared eligibility rule for general market intelligence.

General market intelligence excludes politics/elections, geopolitical conflict, sport and entertainment noise.

Business-relevant regulation, privacy, tax, labour, SaaS, SMB and technology coverage can remain eligible.

Competitor sources are a separate workflow and are not discarded from competitor monitoring.

Evidence selection for generation must respect region.

### Brand OS

Brand OS is region-specific.

Core areas:

- profile / positioning;
- audiences and pains;
- products and claims;
- voice / vocabulary;
- content pillars;
- examples;
- compliance;
- rule-set versions;
- platform playbooks.

The `/brand` workspace must never show another region's profile when the market changes.

### AI providers

Current runtime supports Google, Groq, OpenAI and DeepSeek fallback behavior.

Google key aliases:

- `GEMINI_API_KEY`
- `GOOGLE_GENERATIVE_AI_API_KEY`

See `lib/ai.ts` and `lib/ai-utils.ts`.

## Database discipline

Production Supabase uses a manually consolidated baseline.

Do not casually run historical `supabase db push`.

For additive production data, provide explicit SQL for Supabase SQL Editor plus a verification query.

Historical migrations are intentionally retained because changing already-applied migration history can desynchronize Supabase.

## Verification discipline

For normal code changes:

```bash
npm test
npm run build
node scripts/verify-august-ui.mjs
git diff --check
```

Also run the relevant product verifier:

- `verify-mvp-runtime.mjs`
- `verify-final-workspaces.mjs`
- `verify-multimarket-localization.mjs`
- `verify-social-source-sprint.mjs`
- `verify-amado-chain.mjs`

Do not create a verifier that asserts guessed UI text or brittle implementation details. Verify behavior/invariants.

## Patch discipline

One task = one consolidated patch.

Before delivery:

1. inspect the real target code;
2. patch structurally when a file has already been touched by earlier patches;
3. run syntax/type/tests/build;
4. rerun the patch when idempotency matters;
5. do not leave patch scripts in repository root.

Root `apply_*.py`, `fix*.py`, recovery scripts, Repomix exports and Python caches are temporary artifacts and should not be committed.

## Current documentation

`README.md` is the primary engineering/product overview.

`docs/AMADO_ROADMAP.md` tracks current direction rather than every historical patch.

`docs/SCHEMA.md` is the schema map.

Old patch-by-patch narrative should not be reintroduced into HANDOFF.

## Deferred unless explicitly requested

Do not build these autonomously:

- direct social publishing;
- protected/private social scraping;
- autonomous campaign decisions;
- automatic Brand OS learning without review;
- automatic external social-metrics ingestion;
- complex agent swarms;
- document/OCR pipelines unrelated to the current product priorities.
