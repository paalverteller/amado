# Amado repository rules

## Read first

Before changing code:

1. read `README.md`;
2. read `HANDOFF.md`;
3. read `AGENTS.md` for Next.js-specific constraints;
4. inspect the real target files before writing a patch.

## Coding

- Think about code in English.
- Code, comments, identifiers and commit messages are English.
- Make surgical changes.
- Preserve working behavior.
- Do not refactor unrelated files.
- Prefer simple implementations.
- One task = one consolidated patch.
- Do not leave root patch/recovery scripts in the repository.

## Next.js

This repository uses Next.js 16 App Router.

Read relevant local Next.js docs in `node_modules/next/dist/docs/` when framework behavior matters.

The request proxy is `proxy.ts`.

Do not add `middleware.ts`.

## Product invariants

- UI is Russian.
- Market locale follows selected region.
- Active markets: BR / ES / DE / US.
- Brand OS is region-specific.
- General market intelligence excludes political/election, sport and entertainment noise.
- Competitor monitoring is separate.
- Social generation uses active Brand OS platform playbooks.
- High-risk factual/legal/security/customer claims require human review.

## Supabase

Do not run historical `supabase db push` just to activate additive data.

When production activation needs SQL, provide a separate SQL Editor block plus verification query.

Do not rewrite already-applied migration history casually.

## Verification

At minimum before push:

```bash
npm test
npm run build
node scripts/verify-august-ui.mjs
git diff --check
```

Run feature-specific verifiers when relevant.

Verifier rules:

- verify behavior and invariants;
- do not assert guessed copy;
- do not depend on brittle whitespace/order unless order is itself a contract.

## Delivery

Final coding delivery should be minimal:

1. one downloadable Python patch when practical;
2. one command block for apply / verify / commit / push;
3. Supabase SQL separately in chat when needed.
