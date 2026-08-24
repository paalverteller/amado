#!/usr/bin/env python3
from __future__ import annotations

import re
from pathlib import Path

ROOT = Path.cwd()


def fail(message: str) -> None:
    raise RuntimeError(message)


def file_path(rel: str) -> Path:
    target = ROOT / rel
    if not target.exists():
        fail(f"Missing file: {rel}. Run from the Amado repository root.")
    return target


def read(rel: str) -> str:
    return file_path(rel).read_text(encoding="utf-8")


def write(rel: str, text: str) -> None:
    file_path(rel).write_text(text, encoding="utf-8")


def import_statement_end(text: str, start: int) -> int:
    """Return the character offset immediately after one TS import statement."""
    line_end = text.find("\n", start)
    if line_end < 0:
        line_end = len(text)

    first_line = text[start:line_end]

    # One-line imports:
    # import x from '...'
    # import { x } from '...'
    # import type { x } from '...'
    # import '...'
    if re.search(r"\bfrom\s+['\"][^'\"]+['\"]\s*;?\s*$", first_line):
        return min(line_end + 1, len(text))
    if re.match(r"^import\s+['\"][^'\"]+['\"]\s*;?\s*$", first_line):
        return min(line_end + 1, len(text))

    # Multiline import. Find its closing `from '...'` line.
    pos = line_end + 1
    while pos < len(text):
        next_end = text.find("\n", pos)
        if next_end < 0:
            next_end = len(text)
        line = text[pos:next_end]
        if re.search(r"\bfrom\s+['\"][^'\"]+['\"]\s*;?\s*$", line):
            return min(next_end + 1, len(text))
        pos = next_end + 1

    fail("Could not find the end of a multiline import statement")


def relocate_import(rel: str, import_line: str) -> None:
    text = read(rel)

    # Remove every previous copy, including copies accidentally inserted
    # into the middle of a multiline import block.
    pattern = re.compile(rf"^{re.escape(import_line)}\s*\n?", flags=re.M)
    text = pattern.sub("", text)

    starts = [match.start() for match in re.finditer(r"^import\b", text, flags=re.M)]
    if not starts:
        fail(f"{rel}: no import statements found")

    last_end = 0
    for start in starts:
        end = import_statement_end(text, start)
        if end > last_end:
            last_end = end

    text = text[:last_end] + import_line + "\n" + text[last_end:]
    write(rel, text)


# Imports added by the previous sprint patch. Normalize all of them, not only
# the first file that esbuild happened to report.
TARGETS = [
    (
        "lib/rss.ts",
        "import { isMarketEvidenceEligible } from '@/lib/market-source-policy'",
    ),
    (
        "lib/evidence.ts",
        "import { isMarketEvidenceEligible } from '@/lib/market-source-policy'",
    ),
    (
        "app/api/market/route.ts",
        "import { isMarketEvidenceEligible } from '@/lib/market-source-policy'",
    ),
    (
        "lib/briefing.ts",
        "import { isMarketEvidenceEligible } from '@/lib/market-source-policy'",
    ),
    (
        "app/api/overview/dashboard/route.ts",
        "import { isMarketEvidenceEligible } from '@/lib/market-source-policy'",
    ),
    (
        "app/api/market/deep-analysis/route.ts",
        "import { isMarketEvidenceEligible } from '@/lib/market-source-policy'",
    ),
    (
        "lib/content-generation/generate-article.ts",
        "import { buildSocialPlaybookContext } from '@/lib/social-generation-policy'",
    ),
]

for rel, import_line in TARGETS:
    relocate_import(rel, import_line)


# Structural verification.
errors: list[str] = []

for rel, import_line in TARGETS:
    text = read(rel)

    if text.count(import_line) != 1:
        errors.append(f"{rel}: expected exactly one `{import_line}`")

    if re.search(r"import\s*\{\s*\nimport\b", text):
        errors.append(f"{rel}: import inserted inside multiline import block")

    # Catch the exact failure that broke generate-article.ts.
    if "import {\nimport {" in text:
        errors.append(f"{rel}: malformed adjacent import block")

generate = read("lib/content-generation/generate-article.ts")
expected_order = """import {
  createSupabaseContentRequestRepository,
  type ContentRequestRepository,
} from '@/lib/repositories/content-request-repository'
import {
  createSupabaseArticleRepository,
  type ArticleRepository,
} from '@/lib/repositories/article-repository'
import { buildSocialPlaybookContext } from '@/lib/social-generation-policy'"""

if expected_order not in generate:
    errors.append(
        "lib/content-generation/generate-article.ts: repository imports were not restored correctly"
    )

if errors:
    fail("Import recovery verification failed:\n- " + "\n- ".join(errors))

print("PASS: repaired all imports added by the social/source sprint")
print("PASS: generate-article.ts repository import blocks restored")
print("PASS: no added import remains inside a multiline import block")
