#!/usr/bin/env bash
set -euo pipefail

ROOT="${1:-.}"
cd "$ROOT"

VERIFIER="scripts/verify-market-intelligence-sprint.mjs"

if [[ ! -f "$VERIFIER" ]]; then
  echo "ERROR: $VERIFIER not found."
  echo "Apply the sprint patch first:"
  echo "  python3 apply_amado_market_intelligence_sprint_20260909.py ."
  exit 1
fi

if ! command -v node >/dev/null 2>&1; then
  echo "ERROR: Node.js is not installed or not available in PATH."
  exit 1
fi

echo "Running Amado Market Intelligence Sprint verification..."
node "$VERIFIER"

echo
echo "PASS: Market Intelligence Sprint verification completed."
