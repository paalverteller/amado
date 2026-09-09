#!/usr/bin/env bash
set -euo pipefail

ROOT="${1:-.}"
cd "$ROOT"

PASS_COUNT=0
FAIL_COUNT=0

pass() {
  PASS_COUNT=$((PASS_COUNT + 1))
  printf 'PASS  %s\n' "$1"
}

fail() {
  FAIL_COUNT=$((FAIL_COUNT + 1))
  printf 'FAIL  %s%s\n' "$1" "${2:+ — $2}"
}

require_file() {
  if [[ ! -f "$1" ]]; then
    echo "ERROR: required file not found: $1"
    exit 1
  fi
}

contains() {
  grep -Fq -- "$2" "$1"
}

not_contains() {
  ! grep -Fq -- "$2" "$1"
}

all_market_consumers_ready=true
for path in \
  app/brand/page.tsx \
  app/generate/page.tsx \
  app/generate/seo/page.tsx \
  app/ideas/page.tsx \
  app/localize/page.tsx \
  app/market/analysis/page.tsx \
  app/market/page.tsx \
  app/rewrite/page.tsx \
  app/settings/page.tsx \
  app/competitors/page.tsx; do
  require_file "$path"
  if ! contains "$path" 'useMarket'; then
    all_market_consumers_ready=false
  fi
  if ! contains "$path" 'marketReady' && ! contains "$path" 'ready'; then
    all_market_consumers_ready=false
  fi
done

require_file lib/market-context.tsx
if not_contains lib/market-context.tsx 'br-fallback' \
  && contains lib/market-context.tsx 'ready: boolean' \
  && contains lib/market-context.tsx 'resolveMarketCode' \
  && contains lib/market-context.tsx 'const [regions, setRegions] = useState<MarketRegion[]>([])'; then
  pass 'Market context has no fake fallback region'
else
  fail 'Market context has no fake fallback region'
fi

if [[ "$all_market_consumers_ready" == true ]]; then
  pass 'Market-scoped workspaces wait for resolved market state'
else
  fail 'Market-scoped workspaces wait for resolved market state' 'one or more workspaces do not wait for market readiness'
fi

require_file components/QuickCreateDialog.tsx
if contains components/QuickCreateDialog.tsx 'regionId: currentRegion.id' \
  && contains components/QuickCreateDialog.tsx 'marketUnavailable' \
  && not_contains components/QuickCreateDialog.tsx 'br-fallback'; then
  pass 'Quick Create submits only a real region id'
else
  fail 'Quick Create submits only a real region id'
fi

require_file components/ui/AugustDialog.tsx
if contains components/ui/AugustDialog.tsx "event.key !== 'Tab'" \
  && contains components/ui/AugustDialog.tsx 'previousActiveElement' \
  && contains components/ui/AugustDialog.tsx 'focusableElements' \
  && contains components/ui/AugustDialog.tsx 'aria-describedby'; then
  pass 'August dialog implements focus management'
else
  fail 'August dialog implements focus management'
fi

require_file app/competitors/page.tsx
if contains app/competitors/page.tsx 'AbortController' \
  && contains app/competitors/page.tsx 'aria-expanded' \
  && contains app/competitors/page.tsx 'role="alert"' \
  && contains app/competitors/page.tsx 'toast.error' \
  && contains app/competitors/page.tsx 'region_id: currentRegion.id'; then
  pass 'Competitor UI is market-safe and failure-visible'
else
  fail 'Competitor UI is market-safe and failure-visible'
fi

require_file app/api/competitors/route.ts
if contains app/api/competitors/route.ts 'region_id?: string' \
  && contains app/api/competitors/route.ts 'resolveBrandIdForRegion' \
  && contains app/api/competitors/route.ts 'Competitor already exists in this market'; then
  pass 'Competitor creation resolves market-specific Brand OS'
else
  fail 'Competitor creation resolves market-specific Brand OS'
fi

require_file app/api/rss/route.ts
require_file supabase/migrations/047_competitor_source_links.sql
if contains app/api/rss/route.ts "from('competitor_source_links')" \
  && contains supabase/migrations/047_competitor_source_links.sql 'PRIMARY KEY (competitor_id, source_id)' \
  && contains supabase/migrations/047_competitor_source_links.sql 'WHERE competitor_id IS NOT NULL'; then
  pass 'Competitor sources support many-to-many market reuse'
else
  fail 'Competitor sources support many-to-many market reuse'
fi

require_file lib/competitor-review.ts
if contains lib/competitor-review.ts 'OFFICIAL COMPANY SOURCE' \
  && contains lib/competitor-review.ts 'INDEPENDENT MARKET SOURCE' \
  && contains lib/competitor-review.ts ".eq('region_id', regionId)" \
  && contains lib/competitor-review.ts "source.source_category !== 'competitor'" \
  && contains lib/competitor-review.ts "retrieval_mode: 'evidence'"; then
  pass 'Competitor review separates official and independent evidence'
else
  fail 'Competitor review separates official and independent evidence'
fi

require_file lib/rss.ts
if contains lib/rss.ts 'preserveCompanyNews' \
  && contains lib/rss.ts "data?.source_category === 'competitor'" \
  && contains lib/rss.ts "'press release'" \
  && contains lib/rss.ts 'companyNewsSignals'; then
  pass 'Competitor ingestion preserves company-news signals'
else
  fail 'Competitor ingestion preserves company-news signals'
fi

require_file supabase/seeds/009_market_intelligence_sprint_20260909.sql
SEED='supabase/seeds/009_market_intelligence_sprint_20260909.sql'
for code in BR ES DE US; do
  count=$(grep -Ec "\\('${code}',[0-9]+," "$SEED" || true)
  if [[ "$count" -eq 12 ]]; then
    pass "$code competitor set has 12 entries"
  else
    fail "$code competitor set has 12 entries" "$count/12"
  fi
done

for source in \
  'ABES — Press Releases' \
  'Brasscom — Publicações' \
  'Red.es — Noticias' \
  'Adigital — Actualidad' \
  'Bitkom — Presseinformationen' \
  'CIO — Enterprise Applications' \
  'Software Advice — Resources'; do
  if contains "$SEED" "$source"; then
    pass "Market source seeded: $source"
  else
    fail "Market source seeded: $source"
  fi
done

for competitor in Ploomes Kenlo Holded Witei sevdesk onOffice 'Follow Up Boss'; do
  if contains "$SEED" "'$competitor'"; then
    pass "Vertical/local competitor seeded: $competitor"
  else
    fail "Vertical/local competitor seeded: $competitor"
  fi
done

if ! perl -0777 -ne 'exit 0 if /UPDATE rss_sources.{0,180}updated_at/is || /ON CONFLICT \(url\) DO UPDATE SET.{0,500}updated_at = now\(\);/is; exit 1' "$SEED"; then
  pass 'Seed does not assume rss_sources.updated_at exists'
else
  fail 'Seed does not assume rss_sources.updated_at exists'
fi

require_file docs/AMADO_ROADMAP.md
if contains docs/AMADO_ROADMAP.md 'Fable remediation Phases 0–6 are complete' \
  && not_contains docs/AMADO_ROADMAP.md '### 1. Fable Phase 5'; then
  pass 'Roadmap closes Fable phases 5 and 6'
else
  fail 'Roadmap closes Fable phases 5 and 6'
fi

TOTAL=$((PASS_COUNT + FAIL_COUNT))
printf '\n%d/%d market-intelligence sprint checks passed.\n' "$PASS_COUNT" "$TOTAL"

if [[ "$FAIL_COUNT" -ne 0 ]]; then
  exit 1
fi
