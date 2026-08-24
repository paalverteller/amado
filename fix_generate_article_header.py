#!/usr/bin/env python3
from __future__ import annotations

from pathlib import Path

ROOT = Path.cwd()
TARGET = ROOT / "lib/content-generation/generate-article.ts"

if not TARGET.exists():
    raise RuntimeError(
        "Missing lib/content-generation/generate-article.ts. "
        "Run this script from the Amado repository root."
    )

text = TARGET.read_text(encoding="utf-8")

marker = "export interface GenerateArticleInput {"
pos = text.find(marker)
if pos < 0:
    raise RuntimeError(
        "Could not find `export interface GenerateArticleInput {` in "
        "lib/content-generation/generate-article.ts."
    )

# Canonical import header from the audited repomix, plus the one social
# playbook import added by this sprint. Replacing the entire header avoids
# every malformed/duplicate/partially inserted import state from prior runs.
header = """import { buildSystemPrompt, buildUserPrompt, buildLocalizationNotesPrompt, buildRegionContextLayer, resolveRegionProfile, buildEvidenceContext, buildKnowledgeContext, buildCompetitorContext } from '@/lib/prompts'
import { buildBrandSnapshot, resolveBrandRegionId } from '@/lib/brand-snapshot'
import { getRecentEvidenceContext } from '@/lib/evidence'
import { generateArticleWithFallback, generateWithFallback } from '@/lib/ai'
import { recordAiUsage } from '@/lib/ai-usage'
import { cleanPlainTextOutput } from '@/lib/text-cleanup'
import { mapToLegacyContentType } from '@/lib/content-formats'
import type { ContentFormat } from '@/lib/content-formats'
import crypto from 'crypto'
import {
  createSupabaseContentRequestRepository,
  type ContentRequestRepository,
} from '@/lib/repositories/content-request-repository'
import {
  createSupabaseArticleRepository,
  type ArticleRepository,
} from '@/lib/repositories/article-repository'
import { buildSocialPlaybookContext } from '@/lib/social-generation-policy'

"""

updated = header + text[pos:]
TARGET.write_text(updated, encoding="utf-8")

# Verify only invariants that are actually required.
checks = {
    "content request repository import":
        "createSupabaseContentRequestRepository" in updated,
    "article repository import":
        "createSupabaseArticleRepository" in updated,
    "social playbook import":
        "import { buildSocialPlaybookContext } from '@/lib/social-generation-policy'" in updated,
    "social playbook call preserved":
        "buildSocialPlaybookContext(input.contentType, input.brandProfileId)" in updated,
    "region-aware evidence preserved":
        "getRecentEvidenceContext(trimmedTopic, 5, effectiveRegionId)" in updated,
    "no nested import corruption":
        "import {\nimport " not in updated,
    "single social import":
        updated.count(
            "import { buildSocialPlaybookContext } from '@/lib/social-generation-policy'"
        ) == 1,
}

failed = [name for name, ok in checks.items() if not ok]
if failed:
    raise RuntimeError(
        "Header recovery verification failed:\n- " + "\n- ".join(failed)
    )

print("PASS: generate-article.ts import header restored")
print("PASS: social playbook integration preserved")
print("PASS: region-aware evidence integration preserved")
