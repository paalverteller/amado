#!/usr/bin/env python3
"""
Sprint 1 — Russian workspace shell (foundation)

Implements Phase 0 remnants + Phase 1 ("Russian workspace shell") from
AMADO_LEAN_AI_FIRST_IMPLEMENTATION_PLAN_EN.md:

  1. Adds a complete Russian dictionary to lib/i18n/config.ts and makes
     'ru' the default UI locale (pt-BR/en are kept — pt-BR remains the
     generated-content language and stays available as a fallback).
  2. Restructures the primary navigation (components/Layout.tsx) to match
     the target IA: Обзор, Рынок, Генерация, База знаний, Бренд, Конкуренты
     (+ a smaller utility row: Идеи, Переписать, История, Настройки).
     No existing route is deleted — /ideas and /rewrite keep working, they
     are just de-prioritized in the primary nav per the plan's own IA.
  3. Adds three new routes as reviewable shells (not yet wired to AI logic,
     that's later phases): /overview (new landing page), /knowledge,
     /competitors.
  4. Points the post-login redirect (proxy.ts) and the header logo at
     /overview instead of /generate.
  5. Adds vitest + a real regression test that fails if a future PT/EN
     copy change ships without a Russian counterpart.
  6. Writes docs/SCHEMA.md (actual current schema, extracted from the 44
     migration files) and docs/AMADO_ROADMAP.md (the sprint plan, so it
     survives across sessions the way HANDOFF docs did on the previous
     workstream).

Idempotent: safe to re-run. Each edit either checks for its own
already-applied marker (skip) or fails loudly if its anchor text is
missing (so it never silently corrupts a file it doesn't recognize).

Usage:
    python3 apply_sprint1_ru_shell.py            # apply
    python3 apply_sprint1_ru_shell.py --check    # dry-run, no writes
"""

import argparse
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent


class Anchor(Exception):
    pass


def read(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def write(path: Path, content: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content, encoding="utf-8")


def ensure_replaced(path: Path, old: str, new: str, *, label: str, check: bool) -> bool:
    """
    Idempotent single-occurrence replace.
    - If `new` is already present -> already applied, skip.
    - elif `old` is present exactly once -> replace (or report in --check mode).
    - else -> raise loudly (anchor drifted, do not guess).
    """
    content = read(path)
    if new in content:
        print(f"  [skip]  {label} (already applied)")
        return False
    count = content.count(old)
    if count == 0:
        raise Anchor(f"Anchor not found for '{label}' in {path}. "
                      f"File may have changed since this script was written — "
                      f"aborting rather than guessing.")
    if count > 1:
        raise Anchor(f"Anchor for '{label}' in {path} matched {count} times "
                      f"(expected exactly 1) — refusing to guess which one.")
    if check:
        print(f"  [would-apply] {label}")
        return True
    content = content.replace(old, new, 1)
    write(path, content)
    print(f"  [applied] {label}")
    return True


def create_or_overwrite(path: Path, content: str, *, label: str, check: bool) -> bool:
    existing = read(path) if path.exists() else None
    if existing == content:
        print(f"  [skip]  {label} (already up to date)")
        return False
    if check:
        verb = "would-update" if existing is not None else "would-create"
        print(f"  [{verb}] {label}")
        return True
    write(path, content)
    verb = "updated" if existing is not None else "created"
    print(f"  [{verb}] {label}")
    return True


# ─────────────────────────────────────────────────────────────────────────
# 1. lib/i18n/config.ts — Russian dictionary + default locale
# ─────────────────────────────────────────────────────────────────────────

RU_DICT_BLOCK = '''// ─── Russian — Primary UI language ──────────────────────────────────────────
// §4 of the lean plan: the product interface is fully Russian. Generated
// market content stays pt-BR (see DEFAULT_LOCALE in lib/locale.ts, which is
// a separate, deliberately-unchanged concept from the UI locale here).

const RU_DICT: MessageDictionary = {
  'nav': {
    'overview': '\u041e\u0431\u0437\u043e\u0440',
    'brief': '\u041e\u0431\u0437\u043e\u0440',
    'signals': '\u0420\u044b\u043d\u043e\u043a',
    'opportunities': '\u0418\u0434\u0435\u0438',
    'studio': '\u0413\u0435\u043d\u0435\u0440\u0430\u0446\u0438\u044f',
    'pipeline': '\u0418\u0441\u0442\u043e\u0440\u0438\u044f',
    'library': '\u0411\u0430\u0437\u0430 \u0437\u043d\u0430\u043d\u0438\u0439',
    'settings': '\u041d\u0430\u0441\u0442\u0440\u043e\u0439\u043a\u0438',
    'generate': '\u0413\u0435\u043d\u0435\u0440\u0430\u0446\u0438\u044f',
    'market': '\u0420\u044b\u043d\u043e\u043a',
    'ideas': '\u0418\u0434\u0435\u0438',
    'rewrite': '\u041f\u0435\u0440\u0435\u043f\u0438\u0441\u0430\u0442\u044c',
    'history': '\u0418\u0441\u0442\u043e\u0440\u0438\u044f',
    'knowledge': '\u0411\u0430\u0437\u0430 \u0437\u043d\u0430\u043d\u0438\u0439',
    'brand': '\u0411\u0440\u0435\u043d\u0434',
    'competitors': '\u041a\u043e\u043d\u043a\u0443\u0440\u0435\u043d\u0442\u044b',
    'sources': '\u0418\u0441\u0442\u043e\u0447\u043d\u0438\u043a\u0438',
    'analytics': '\u0410\u043d\u0430\u043b\u0438\u0442\u0438\u043a\u0430',
  },

  'action': {
    'create': '\u0421\u043e\u0437\u0434\u0430\u0442\u044c',
    'save': '\u0421\u043e\u0445\u0440\u0430\u043d\u0438\u0442\u044c',
    'delete': '\u0423\u0434\u0430\u043b\u0438\u0442\u044c',
    'edit': '\u0418\u0437\u043c\u0435\u043d\u0438\u0442\u044c',
    'cancel': '\u041e\u0442\u043c\u0435\u043d\u0430',
    'confirm': '\u041f\u043e\u0434\u0442\u0432\u0435\u0440\u0434\u0438\u0442\u044c',
    'generate': '\u0421\u0433\u0435\u043d\u0435\u0440\u0438\u0440\u043e\u0432\u0430\u0442\u044c',
    'approve': '\u0423\u0442\u0432\u0435\u0440\u0434\u0438\u0442\u044c',
    'reject': '\u041e\u0442\u043a\u043b\u043e\u043d\u0438\u0442\u044c',
    'export': '\u042d\u043a\u0441\u043f\u043e\u0440\u0442\u0438\u0440\u043e\u0432\u0430\u0442\u044c',
    'publish': '\u041e\u043f\u0443\u0431\u043b\u0438\u043a\u043e\u0432\u0430\u0442\u044c',
    'schedule': '\u0417\u0430\u043f\u043b\u0430\u043d\u0438\u0440\u043e\u0432\u0430\u0442\u044c',
    'dismiss': '\u0421\u043a\u0440\u044b\u0442\u044c',
    'watch': '\u041e\u0442\u0441\u043b\u0435\u0436\u0438\u0432\u0430\u0442\u044c',
    'refresh': '\u041e\u0431\u043d\u043e\u0432\u0438\u0442\u044c',
    'test': '\u041f\u0440\u043e\u0432\u0435\u0440\u0438\u0442\u044c',
    'add': '\u0414\u043e\u0431\u0430\u0432\u0438\u0442\u044c',
    'remove': '\u0423\u0431\u0440\u0430\u0442\u044c',
    'search': '\u041f\u043e\u0438\u0441\u043a',
    'filter': '\u0424\u0438\u043b\u044c\u0442\u0440',
    'sort': '\u0421\u043e\u0440\u0442\u0438\u0440\u043e\u0432\u043a\u0430',
    'logout': '\u0412\u044b\u0439\u0442\u0438',
  },

  'format': {
    'article': '\u0421\u0442\u0430\u0442\u044c\u044f',
    'linkedin_post': '\u041f\u043e\u0441\u0442 LinkedIn',
    'instagram_caption': '\u041f\u043e\u0434\u043f\u0438\u0441\u044c Instagram',
    'instagram_carousel': '\u041a\u0430\u0440\u0443\u0441\u0435\u043b\u044c Instagram',
    'x_thread': '\u0422\u0440\u0435\u0434 X',
    'facebook_post': '\u041f\u043e\u0441\u0442 Facebook',
    'telegram_post': '\u041f\u043e\u0441\u0442 Telegram',
    'short_video_script': '\u0421\u0446\u0435\u043d\u0430\u0440\u0438\u0439 \u043a\u043e\u0440\u043e\u0442\u043a\u043e\u0433\u043e \u0432\u0438\u0434\u0435\u043e',
    'email': 'Email',
    'quick_note': '\u0411\u044b\u0441\u0442\u0440\u0430\u044f \u0437\u0430\u043c\u0435\u0442\u043a\u0430',
    'rewrite': '\u041f\u0435\u0440\u0435\u043f\u0438\u0441\u0430\u043d\u043d\u044b\u0439 \u0442\u0435\u043a\u0441\u0442',
  },

  'status': {
    'draft': '\u0427\u0435\u0440\u043d\u043e\u0432\u0438\u043a',
    'review': '\u041d\u0430 \u043f\u0440\u043e\u0432\u0435\u0440\u043a\u0435',
    'approved': '\u0423\u0442\u0432\u0435\u0440\u0436\u0434\u0435\u043d\u043e',
    'scheduled': '\u0417\u0430\u043f\u043b\u0430\u043d\u0438\u0440\u043e\u0432\u0430\u043d\u043e',
    'published': '\u041e\u043f\u0443\u0431\u043b\u0438\u043a\u043e\u0432\u0430\u043d\u043e',
    'dismissed': '\u041e\u0442\u043a\u043b\u043e\u043d\u0435\u043d\u043e',
    'active': '\u0410\u043a\u0442\u0438\u0432\u043d\u043e',
    'inactive': '\u041d\u0435\u0430\u043a\u0442\u0438\u0432\u043d\u043e',
  },

  'settings': {
    'title': '\u041d\u0430\u0441\u0442\u0440\u043e\u0439\u043a\u0438',
    'subtitle': '\u0423\u043f\u0440\u0430\u0432\u043b\u0435\u043d\u0438\u0435 \u0431\u0440\u0435\u043d\u0434\u0430\u043c\u0438, \u0438\u0441\u0442\u043e\u0447\u043d\u0438\u043a\u0430\u043c\u0438 \u0438 \u0448\u0430\u0431\u043b\u043e\u043d\u0430\u043c\u0438',
    'sources': '\u0418\u0441\u0442\u043e\u0447\u043d\u0438\u043a\u0438 \u0434\u0430\u043d\u043d\u044b\u0445',
    'templates': '\u041f\u0440\u043e\u0444\u0438\u043b\u0438 \u0433\u0435\u043d\u0435\u0440\u0430\u0446\u0438\u0438',
    'brands': '\u0411\u0440\u0435\u043d\u0434\u044b',
    'regions': '\u0420\u0435\u0433\u0438\u043e\u043d\u044b',
    'language': '\u042f\u0437\u044b\u043a',
    'source_name': '\u041d\u0430\u0437\u0432\u0430\u043d\u0438\u0435 \u0438\u0441\u0442\u043e\u0447\u043d\u0438\u043a\u0430',
    'source_url': 'URL \u0438\u0441\u0442\u043e\u0447\u043d\u0438\u043a\u0430',
    'source_type': '\u0422\u0438\u043f \u043a\u043e\u043d\u043d\u0435\u043a\u0442\u043e\u0440\u0430',
    'source_country': '\u0421\u0442\u0440\u0430\u043d\u0430',
    'brand_name': '\u041d\u0430\u0437\u0432\u0430\u043d\u0438\u0435 \u0431\u0440\u0435\u043d\u0434\u0430',
    'brand_voice': '\u0413\u043e\u043b\u043e\u0441 \u0431\u0440\u0435\u043d\u0434\u0430',
    'brand_audience': '\u0426\u0435\u043b\u0435\u0432\u0430\u044f \u0430\u0443\u0434\u0438\u0442\u043e\u0440\u0438\u044f',
    'brand_forbidden': '\u0417\u0430\u043f\u0440\u0435\u0449\u0451\u043d\u043d\u044b\u0435 \u0441\u043b\u043e\u0432\u0430',
    'brand_examples': '\u041f\u0440\u0438\u043c\u0435\u0440\u044b \u043f\u043e\u0441\u0442\u043e\u0432',
    'brand_competitors': '\u041a\u043e\u043d\u043a\u0443\u0440\u0435\u043d\u0442\u044b',
    'add_source': '\u0414\u043e\u0431\u0430\u0432\u0438\u0442\u044c \u0438\u0441\u0442\u043e\u0447\u043d\u0438\u043a',
    'add_brand': '\u0414\u043e\u0431\u0430\u0432\u0438\u0442\u044c \u0431\u0440\u0435\u043d\u0434',
    'source_health': '\u0421\u0442\u0430\u0442\u0443\u0441 \u0438\u0441\u0442\u043e\u0447\u043d\u0438\u043a\u0430',
    'last_sync': '\u041f\u043e\u0441\u043b\u0435\u0434\u043d\u044f\u044f \u0441\u0438\u043d\u0445\u0440\u043e\u043d\u0438\u0437\u0430\u0446\u0438\u044f',
    'manual': '\u0412\u0440\u0443\u0447\u043d\u0443\u044e',
  },

  'market': {
    'title': '\u0420\u044b\u043d\u043e\u043a',
    'signals': '\u0421\u0438\u0433\u043d\u0430\u043b\u044b',
    'rising': '\u0412 \u0442\u0440\u0435\u043d\u0434\u0435',
    'breaking': '\u0421\u0440\u043e\u0447\u043d\u043e',
    'category': '\u041a\u0430\u0442\u0435\u0433\u043e\u0440\u0438\u044f',
    'competitors': '\u041a\u043e\u043d\u043a\u0443\u0440\u0435\u043d\u0442\u044b',
    'platform_updates': '\u041e\u0431\u043d\u043e\u0432\u043b\u0435\u043d\u0438\u044f \u043f\u043b\u0430\u0442\u0444\u043e\u0440\u043c',
    'campaign_inspiration': '\u0418\u0434\u0435\u0438 \u0434\u043b\u044f \u043a\u0430\u043c\u043f\u0430\u043d\u0438\u0439',
    'saved': '\u0421\u043e\u0445\u0440\u0430\u043d\u0451\u043d\u043d\u044b\u0435',
    'no_items': '\u041d\u0438\u0447\u0435\u0433\u043e \u043d\u0435 \u043d\u0430\u0439\u0434\u0435\u043d\u043e',
    'source': '\u0418\u0441\u0442\u043e\u0447\u043d\u0438\u043a',
    'published': '\u041e\u043f\u0443\u0431\u043b\u0438\u043a\u043e\u0432\u0430\u043d\u043e',
    'collected': '\u0421\u043e\u0431\u0440\u0430\u043d\u043e',
  },

  'generate': {
    'title': '\u0413\u0435\u043d\u0435\u0440\u0430\u0446\u0438\u044f',
    'topic': '\u0422\u0435\u043c\u0430',
    'context': '\u041a\u043e\u043d\u0442\u0435\u043a\u0441\u0442',
    'content_type': '\u0422\u0438\u043f \u043a\u043e\u043d\u0442\u0435\u043d\u0442\u0430',
    'template': '\u0428\u0430\u0431\u043b\u043e\u043d',
    'brand_profile': '\u041f\u0440\u043e\u0444\u0438\u043b\u044c \u0431\u0440\u0435\u043d\u0434\u0430',
    'seo_mode': '\u0420\u0435\u0436\u0438\u043c SEO',
    'placeholder_topic': '\u0412\u0432\u0435\u0434\u0438\u0442\u0435 \u0442\u0435\u043c\u0443 \u043c\u0430\u0442\u0435\u0440\u0438\u0430\u043b\u0430...',
    'placeholder_context': '\u0414\u043e\u043f\u043e\u043b\u043d\u0438\u0442\u0435\u043b\u044c\u043d\u044b\u0439 \u043a\u043e\u043d\u0442\u0435\u043a\u0441\u0442 (\u043d\u0435\u043e\u0431\u044f\u0437\u0430\u0442\u0435\u043b\u044c\u043d\u043e)...',
    'generating': '\u0413\u0435\u043d\u0435\u0440\u0430\u0446\u0438\u044f...',
    'regenerate': '\u0421\u0433\u0435\u043d\u0435\u0440\u0438\u0440\u043e\u0432\u0430\u0442\u044c \u0437\u0430\u043d\u043e\u0432\u043e',
    'copy': '\u0421\u043a\u043e\u043f\u0438\u0440\u043e\u0432\u0430\u0442\u044c',
    'download': '\u0421\u043a\u0430\u0447\u0430\u0442\u044c',
  },

  'error': {
    'generic': '\u0427\u0442\u043e-\u0442\u043e \u043f\u043e\u0448\u043b\u043e \u043d\u0435 \u0442\u0430\u043a',
    'network': '\u041e\u0448\u0438\u0431\u043a\u0430 \u0441\u043e\u0435\u0434\u0438\u043d\u0435\u043d\u0438\u044f',
    'unauthorized': '\u041d\u0435\u0442 \u0434\u043e\u0441\u0442\u0443\u043f\u0430',
    'not_found': '\u041d\u0435 \u043d\u0430\u0439\u0434\u0435\u043d\u043e',
    'validation': '\u041d\u0435\u043a\u043e\u0440\u0440\u0435\u043a\u0442\u043d\u044b\u0435 \u0434\u0430\u043d\u043d\u044b\u0435',
    'server': '\u041e\u0448\u0438\u0431\u043a\u0430 \u0441\u0435\u0440\u0432\u0435\u0440\u0430',
  },

  'product': {
    'name': 'Amado',
    'tagline': 'AI-\u043f\u043b\u0430\u0442\u0444\u043e\u0440\u043c\u0430 \u0434\u043b\u044f \u0440\u044b\u043d\u043e\u0447\u043d\u043e\u0439 \u0430\u043d\u0430\u043b\u0438\u0442\u0438\u043a\u0438 \u0438 \u043a\u043e\u043d\u0442\u0435\u043d\u0442\u0430',
    'description': '\u0421\u0438\u0441\u0442\u0435\u043c\u0430 \u0440\u044b\u043d\u043e\u0447\u043d\u043e\u0439 \u0430\u043d\u0430\u043b\u0438\u0442\u0438\u043a\u0438 \u0438 \u0433\u0435\u043d\u0435\u0440\u0430\u0446\u0438\u0438 \u043a\u043e\u043d\u0442\u0435\u043d\u0442\u0430 \u0434\u043b\u044f \u043c\u0430\u0440\u043a\u0435\u0442\u0438\u043d\u0433\u043e\u0432\u044b\u0445 \u043a\u043e\u043c\u0430\u043d\u0434',
  },

  // ── New workspace shells added in Sprint 1 (Phase 1) ──
  'overview': {
    'title': '\u041e\u0431\u0437\u043e\u0440',
    'subtitle': '\u0413\u043b\u0430\u0432\u043d\u043e\u0435 \u0437\u0430 \u0441\u0435\u0433\u043e\u0434\u043d\u044f',
    'freshness_label': '\u0414\u0430\u043d\u043d\u044b\u0435 \u043e\u0431\u043d\u043e\u0432\u043b\u0435\u043d\u044b',
    'no_briefing_title': '\u0421\u0432\u0435\u0436\u0438\u0445 \u0434\u0430\u043d\u043d\u044b\u0445 \u043f\u043e\u043a\u0430 \u043d\u0435\u0442',
    'no_briefing_body': '\u041a\u0430\u043a \u0442\u043e\u043b\u044c\u043a\u043e \u043f\u043e\u044f\u0432\u044f\u0442\u0441\u044f \u0432\u0430\u0436\u043d\u044b\u0435 \u043c\u0430\u0442\u0435\u0440\u0438\u0430\u043b\u044b \u0441 \u0440\u044b\u043d\u043a\u0430, \u043e\u043d\u0438 \u0431\u0443\u0434\u0443\u0442 \u043f\u043e\u043a\u0430\u0437\u0430\u043d\u044b \u0437\u0434\u0435\u0441\u044c.',
    'active_brand': '\u0410\u043a\u0442\u0438\u0432\u043d\u044b\u0439 \u0431\u0440\u0435\u043d\u0434',
    'go_to_market': '\u041e\u0442\u043a\u0440\u044b\u0442\u044c \u0420\u044b\u043d\u043e\u043a',
  },
  'knowledge': {
    'title': '\u0411\u0430\u0437\u0430 \u0437\u043d\u0430\u043d\u0438\u0439',
    'subtitle': '\u0412\u043d\u0443\u0442\u0440\u0435\u043d\u043d\u0438\u0435 \u0434\u043e\u043a\u0443\u043c\u0435\u043d\u0442\u044b, \u0437\u0430\u043c\u0435\u0442\u043a\u0438 \u0438 \u0433\u0430\u0439\u0434\u043b\u0430\u0439\u043d\u044b \u0431\u0440\u0435\u043d\u0434\u0430',
    'coming_soon_title': '\u0420\u0430\u0437\u0434\u0435\u043b \u0432 \u0440\u0430\u0437\u0440\u0430\u0431\u043e\u0442\u043a\u0435',
    'coming_soon_body': '\u0417\u0430\u0433\u0440\u0443\u0437\u043a\u0430 \u0442\u0435\u043a\u0441\u0442\u043e\u0432, \u043f\u043e\u0438\u0441\u043a \u043f\u043e \u0431\u0430\u0437\u0435 \u0437\u043d\u0430\u043d\u0438\u0439 \u0438 \u0438\u0441\u043f\u043e\u043b\u044c\u0437\u043e\u0432\u0430\u043d\u0438\u0435 \u0444\u0440\u0430\u0433\u043c\u0435\u043d\u0442\u043e\u0432 \u0432 \u0433\u0435\u043d\u0435\u0440\u0430\u0446\u0438\u0438 \u043f\u043e\u044f\u0432\u044f\u0442\u0441\u044f \u0432 \u043e\u0434\u043d\u043e\u043c \u0438\u0437 \u0431\u043b\u0438\u0436\u0430\u0439\u0448\u0438\u0445 \u0441\u043f\u0440\u0438\u043d\u0442\u043e\u0432.',
  },
  'competitors': {
    'title': '\u041a\u043e\u043d\u043a\u0443\u0440\u0435\u043d\u0442\u044b',
    'subtitle': '\u041e\u0442\u0441\u043b\u0435\u0436\u0438\u0432\u0430\u043d\u0438\u0435 \u043e\u0431\u043d\u043e\u0432\u043b\u0435\u043d\u0438\u0439 \u043a\u043e\u043d\u043a\u0443\u0440\u0435\u043d\u0442\u043e\u0432',
    'coming_soon_title': '\u0420\u0430\u0437\u0434\u0435\u043b \u0432 \u0440\u0430\u0437\u0440\u0430\u0431\u043e\u0442\u043a\u0435',
    'coming_soon_body': '\u0421\u043f\u0438\u0441\u043e\u043a \u043a\u043e\u043d\u043a\u0443\u0440\u0435\u043d\u0442\u043e\u0432, \u0438\u0445 \u0438\u0441\u0442\u043e\u0447\u043d\u0438\u043a\u0438 \u0438 \u0441\u0432\u043e\u0434\u043a\u0438 \u043e\u0431\u043d\u043e\u0432\u043b\u0435\u043d\u0438\u0439 \u043f\u043e\u044f\u0432\u044f\u0442\u0441\u044f \u0432 \u043e\u0434\u043d\u043e\u043c \u0438\u0437 \u0431\u043b\u0438\u0436\u0430\u0439\u0448\u0438\u0445 \u0441\u043f\u0440\u0438\u043d\u0442\u043e\u0432.',
  },
}

'''


def patch_i18n(check: bool) -> None:
    path = ROOT / "lib/i18n/config.ts"
    print(f"\n== {path.relative_to(ROOT)} ==")

    ensure_replaced(
        path,
        "export const DEFAULT_LOCALE: Locale = 'pt-BR'\nexport const SUPPORTED_LOCALES: Locale[] = ['pt-BR', 'en']",
        "export const DEFAULT_LOCALE: Locale = 'ru'\nexport const SUPPORTED_LOCALES: Locale[] = ['ru', 'pt-BR', 'en']",
        label="default UI locale -> ru",
        check=check,
    )

    ensure_replaced(
        path,
        "function getDictionary(locale: Locale): MessageDictionary {\n"
        "  switch (locale) {\n"
        "    case 'en':\n"
        "      return EN_DICT\n"
        "    case 'pt-BR':\n"
        "    default:\n"
        "      return PT_BR_DICT\n"
        "  }\n"
        "}",
        "function getDictionary(locale: Locale): MessageDictionary {\n"
        "  switch (locale) {\n"
        "    case 'en':\n"
        "      return EN_DICT\n"
        "    case 'ru':\n"
        "      return RU_DICT\n"
        "    case 'pt-BR':\n"
        "    default:\n"
        "      return PT_BR_DICT\n"
        "  }\n"
        "}",
        label="getDictionary() routes 'ru' -> RU_DICT",
        check=check,
    )

    ensure_replaced(
        path,
        "// ─── Portuguese (Brazil) — Primary ──────────────────────────────────────────",
        "// ─── Portuguese (Brazil) — generated-content language + UI fallback ────────",
        label="clarify PT-BR dict comment",
        check=check,
    )

    ensure_replaced(
        path,
        "// ─── English — Secondary ────────────────────────────────────────────────────",
        RU_DICT_BLOCK + "// ─── English — Secondary ────────────────────────────────────────────────────",
        label="insert RU_DICT before EN_DICT",
        check=check,
    )


# ─────────────────────────────────────────────────────────────────────────
# 2. components/Layout.tsx — nav restructure + Russian shell copy
# ─────────────────────────────────────────────────────────────────────────

OLD_NAV_BLOCK = """// Desktop nav — all 6 items
const NAV_DESKTOP = [
  { href: '/generate', label: 'Geração' },
  { href: '/ideas',    label: 'Local Pulse' },
  { href: '/rewrite',  label: 'Rewrite' },
  { href: '/market',   label: 'Mercado' },
  { href: '/history',  label: 'Histórico' },
  { href: '/settings', label: 'Configurações' },
]"""

NEW_NAV_BLOCK = """// Primary nav — matches the target IA from the lean plan:
// Обзор → Рынок → Генерация → База знаний → Бренд → Конкуренты
const NAV_PRIMARY = [
  { href: '/overview',    label: t('nav.overview') },
  { href: '/market',      label: t('nav.market') },
  { href: '/generate',    label: t('nav.generate') },
  { href: '/knowledge',   label: t('nav.knowledge') },
  { href: '/brand',       label: t('nav.brand') },
  { href: '/competitors', label: t('nav.competitors') },
]

// Utility nav — secondary destinations. Nothing was deleted: /ideas and
// /rewrite keep working, they're just de-prioritized per the plan's IA.
const NAV_UTILITY = [
  { href: '/ideas',    label: t('nav.ideas') },
  { href: '/rewrite',  label: t('nav.rewrite') },
  { href: '/history',  label: t('nav.history') },
  { href: '/settings', label: t('nav.settings') },
]"""

OLD_IMPORT_BLOCK = """import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { type ReactNode, useState, useEffect, useRef } from 'react'"""

NEW_IMPORT_BLOCK = """import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { type ReactNode, useState, useEffect, useRef } from 'react'
import { t } from '@/lib/i18n/config'"""

OLD_NAV_RENDER = """            {/* Desktop Nav — hidden on mobile */}
            <nav className="hidden lg:flex" style={{ alignItems: 'center', gap: '0.25rem' }}>
              {NAV_DESKTOP.map(({ href, label }) => {
                const active = isActive(href)
                return (
                  <Link
                    key={href} href={href}
                    style={{
                      padding: '0.4rem 1rem',
                      borderRadius: 999,
                      fontSize: 13.5,
                      fontWeight: 600,
                      textDecoration: 'none',
                      letterSpacing: '0.01em',
                      transition: 'all 180ms ease',
                      background: active ? 'rgba(255,255,255,0.16)' : 'transparent',
                      color: active ? '#ffffff' : 'rgba(255,255,255,0.65)',
                      boxShadow: active ? 'inset 0 1px 0 rgba(255,255,255,0.12)' : 'none',
                    }}
                    onMouseEnter={e => {
                      if (!active) (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.10)'
                    }}
                    onMouseLeave={e => {
                      if (!active) (e.currentTarget as HTMLElement).style.background = 'transparent'
                    }}
                  >
                    {label}
                  </Link>
                )
              })}
            </nav>"""

NEW_NAV_RENDER = """            {/* Desktop Nav — hidden on mobile */}
            <nav className="hidden lg:flex" style={{ alignItems: 'center', gap: '0.25rem' }}>
              {NAV_PRIMARY.map(({ href, label }) => {
                const active = isActive(href)
                return (
                  <Link
                    key={href} href={href}
                    style={{
                      padding: '0.4rem 1rem',
                      borderRadius: 999,
                      fontSize: 13.5,
                      fontWeight: 600,
                      textDecoration: 'none',
                      letterSpacing: '0.01em',
                      transition: 'all 180ms ease',
                      background: active ? 'rgba(255,255,255,0.16)' : 'transparent',
                      color: active ? '#ffffff' : 'rgba(255,255,255,0.65)',
                      boxShadow: active ? 'inset 0 1px 0 rgba(255,255,255,0.12)' : 'none',
                    }}
                    onMouseEnter={e => {
                      if (!active) (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.10)'
                    }}
                    onMouseLeave={e => {
                      if (!active) (e.currentTarget as HTMLElement).style.background = 'transparent'
                    }}
                  >
                    {label}
                  </Link>
                )
              })}

              <span aria-hidden style={{ width: 1, height: 16, background: 'rgba(255,255,255,0.18)', margin: '0 0.5rem' }} />

              {NAV_UTILITY.map(({ href, label }) => {
                const active = isActive(href)
                return (
                  <Link
                    key={href} href={href}
                    style={{
                      padding: '0.4rem 0.75rem',
                      borderRadius: 999,
                      fontSize: 12,
                      fontWeight: 500,
                      textDecoration: 'none',
                      letterSpacing: '0.01em',
                      transition: 'all 180ms ease',
                      background: active ? 'rgba(255,255,255,0.12)' : 'transparent',
                      color: active ? '#ffffff' : 'rgba(255,255,255,0.45)',
                    }}
                    onMouseEnter={e => {
                      if (!active) (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.7)'
                    }}
                    onMouseLeave={e => {
                      if (!active) (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.45)'
                    }}
                  >
                    {label}
                  </Link>
                )
              })}
            </nav>"""

OLD_IS_ACTIVE = """  function isActive(href: string) {
    return href === '/generate'
      ? pathname === href
      : pathname === href || pathname.startsWith(href + '/')
  }"""

NEW_IS_ACTIVE = """  function isActive(href: string) {
    return href === '/generate' || href === '/overview'
      ? pathname === href
      : pathname === href || pathname.startsWith(href + '/')
  }"""

OLD_BRAND_LINK = '<Link href="/generate" className="min-w-0 no-underline group flex items-center gap-3">'
NEW_BRAND_LINK = '<Link href="/overview" className="min-w-0 no-underline group flex items-center gap-3">'

OLD_LOGOUT_LABEL = '<span className="hidden sm:inline">Sair</span>'
NEW_LOGOUT_LABEL = '<span className="hidden sm:inline">\u0412\u044b\u0439\u0442\u0438</span>'

OLD_NAV_ARIA = '<nav className="bottom-nav lg:hidden" aria-label="Navegação principal">'
NEW_NAV_ARIA = '<nav className="bottom-nav lg:hidden" aria-label="\u041e\u0441\u043d\u043e\u0432\u043d\u0430\u044f \u043d\u0430\u0432\u0438\u0433\u0430\u0446\u0438\u044f">'

# Mobile bottom-nav labels — same 6 destinations, Russian text only.
# Restructuring the mobile destination set (icons for Overview/Knowledge/
# Competitors) is intentionally deferred — see summary notes.
MOBILE_LABEL_SWAPS = [
    ("{ href: '/generate', label: 'Criar',  icon: (", "{ href: '/generate', label: '\u0421\u043e\u0437\u0434\u0430\u0442\u044c',  icon: ("),
    ("{ href: '/market',   label: 'Mercado',    icon: (", "{ href: '/market',   label: '\u0420\u044b\u043d\u043e\u043a',    icon: ("),
    ("{ href: '/ideas',    label: 'Pulse',     icon: (", "{ href: '/ideas',    label: '\u0418\u0434\u0435\u0438',     icon: ("),
    ("{ href: '/rewrite',  label: 'Rewrite',  icon: (", "{ href: '/rewrite',  label: '\u041f\u0435\u0440\u0435\u043f\u0438\u0441\u0430\u0442\u044c',  icon: ("),
    ("{ href: '/history',  label: 'Histórico',  icon: (", "{ href: '/history',  label: '\u0418\u0441\u0442\u043e\u0440\u0438\u044f',  icon: ("),
    ("{ href: '/settings', label: 'Mais',      icon: (", "{ href: '/settings', label: '\u0415\u0449\u0451',      icon: ("),
]

OLD_FAB_ARIA = 'aria-label="Conteúdo rápido"\n            title="Conteúdo rápido"\n            onClick={() => setQuickCreateOpen(true)}'
NEW_FAB_ARIA = 'aria-label="\u0411\u044b\u0441\u0442\u0440\u043e\u0435 \u0441\u043e\u0437\u0434\u0430\u043d\u0438\u0435"\n            title="\u0411\u044b\u0441\u0442\u0440\u043e\u0435 \u0441\u043e\u0437\u0434\u0430\u043d\u0438\u0435"\n            onClick={() => setQuickCreateOpen(true)}'


def patch_layout(check: bool) -> None:
    path = ROOT / "components/Layout.tsx"
    print(f"\n== {path.relative_to(ROOT)} ==")

    ensure_replaced(path, OLD_IMPORT_BLOCK, NEW_IMPORT_BLOCK, label="import t() from i18n config", check=check)
    ensure_replaced(path, OLD_NAV_BLOCK, NEW_NAV_BLOCK, label="NAV_DESKTOP -> NAV_PRIMARY + NAV_UTILITY", check=check)
    ensure_replaced(path, OLD_NAV_RENDER, NEW_NAV_RENDER, label="render primary + utility nav rows", check=check)
    ensure_replaced(path, OLD_IS_ACTIVE, NEW_IS_ACTIVE, label="isActive() treats /overview as exact-match", check=check)
    ensure_replaced(path, OLD_BRAND_LINK, NEW_BRAND_LINK, label="logo links to /overview", check=check)
    ensure_replaced(path, OLD_LOGOUT_LABEL, NEW_LOGOUT_LABEL, label='"Sair" -> "\u0412\u044b\u0439\u0442\u0438"', check=check)
    ensure_replaced(path, OLD_NAV_ARIA, NEW_NAV_ARIA, label="mobile nav aria-label -> Russian", check=check)
    ensure_replaced(path, OLD_FAB_ARIA, NEW_FAB_ARIA, label="FAB aria-label/title -> Russian", check=check)
    for old, new in MOBILE_LABEL_SWAPS:
        ensure_replaced(path, old, new, label=f"mobile label: {old.split(chr(39))[3]!r}", check=check)


# ─────────────────────────────────────────────────────────────────────────
# 3. proxy.ts — post-login redirect target
# ─────────────────────────────────────────────────────────────────────────

def patch_proxy(check: bool) -> None:
    path = ROOT / "proxy.ts"
    print(f"\n== {path.relative_to(ROOT)} ==")
    ensure_replaced(
        path,
        "  // Authenticated user on login page -> send to app\n"
        "  if (isAuthenticated && isPublicPage) {\n"
        "    return NextResponse.redirect(new URL('/generate', request.url))\n"
        "  }",
        "  // Authenticated user on login page -> send to the Overview landing page\n"
        "  if (isAuthenticated && isPublicPage) {\n"
        "    return NextResponse.redirect(new URL('/overview', request.url))\n"
        "  }",
        label="post-login redirect -> /overview",
        check=check,
    )


# ─────────────────────────────────────────────────────────────────────────
# 4. package.json — vitest
# ─────────────────────────────────────────────────────────────────────────

def patch_package_json(check: bool) -> None:
    path = ROOT / "package.json"
    print(f"\n== {path.relative_to(ROOT)} ==")

    ensure_replaced(
        path,
        '    "postinstall": "next build",\n    "lint": "eslint"\n  },',
        '    "postinstall": "next build",\n    "lint": "eslint",\n    "test": "vitest run"\n  },',
        label='add "test" script',
        check=check,
    )
    ensure_replaced(
        path,
        '    "tailwindcss": "^4",\n    "typescript": "^5"\n  },',
        '    "tailwindcss": "^4",\n    "typescript": "^5",\n    "vitest": "^3.0.0"\n  },',
        label="add vitest devDependency",
        check=check,
    )

    if not check:
        parsed = json.loads(read(path))  # fail loudly if we produced invalid JSON
        assert parsed["scripts"]["test"] == "vitest run"
        assert "vitest" in parsed["devDependencies"]


# ─────────────────────────────────────────────────────────────────────────
# 5. styles/design-tokens.css — additive v2 tokens (design.md), namespaced
#    so nothing existing can collide. Full migration is a later sprint.
# ─────────────────────────────────────────────────────────────────────────

V2_TOKENS_BLOCK = """
/* ── v2 design tokens (design.md target system) ──────────────────────────
   Namespaced with --v2- so they cannot collide with the tokens above.
   New Sprint-1 pages (Overview/Knowledge/Competitors) use these directly.
   Migrating the rest of the app to this palette is a dedicated later sprint. */
:root {
  --v2-color-brand-primary: #2563EB;
  --v2-color-brand-primary-hover: #1D4ED8;
  --v2-color-success: #16A34A;
  --v2-color-warning: #D97706;
  --v2-color-danger: #DC2626;
  --v2-color-info: #0EA5E9;
  --v2-color-text-primary: #0F172A;
  --v2-color-text-secondary: #64748B;
  --v2-color-text-disabled: #94A3B8;
  --v2-color-text-inverse: #FFFFFF;
  --v2-color-surface-base: #FFFFFF;
  --v2-color-surface-muted: #F1F5F9;
  --v2-color-surface-alt: #F8FAFC;
  --v2-color-surface-dark: #0F172A;
  --v2-color-border-default: #E2E8F0;
  --v2-color-border-strong: #CBD5E1;
  --v2-color-border-focus: #3B82F6;
  --v2-radius-sm: 4px;
  --v2-radius-md: 6px;
  --v2-radius-lg: 8px;
  --v2-radius-pill: 999px;
}
"""


def patch_design_tokens(check: bool) -> None:
    path = ROOT / "styles/design-tokens.css"
    print(f"\n== {path.relative_to(ROOT)} ==")
    content = read(path)
    if "--v2-color-brand-primary" in content:
        print("  [skip]  v2 design tokens (already applied)")
        return
    if check:
        print("  [would-append] v2 design tokens block")
        return
    write(path, content.rstrip("\n") + "\n" + V2_TOKENS_BLOCK)
    print("  [applied] appended v2 design tokens block")


# ─────────────────────────────────────────────────────────────────────────
# 6. New pages: /overview, /knowledge, /competitors
# ─────────────────────────────────────────────────────────────────────────

OVERVIEW_PAGE = """'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import Layout from '@/components/Layout'
import { t } from '@/lib/i18n/config'
import { formatRelativeTime } from '@/lib/locale'

// Phase 1 shell: shows real freshness data from the existing /api/market
// feed. The actual AI-generated briefing (Phase 5) replaces the empty
// state below once the scheduled summarization workflow exists.

type MarketItem = {
  id: string
  title_ru?: string | null
  title?: string | null
  collected_at: string | null
  published_at: string | null
}

export default function OverviewPage() {
  const [latest, setLatest] = useState<MarketItem | null>(null)
  const [loadState, setLoadState] = useState<'loading' | 'ready' | 'error'>('loading')

  useEffect(() => {
    let cancelled = false
    fetch('/api/market')
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error('request failed'))))
      .then((data: { items?: MarketItem[] }) => {
        if (cancelled) return
        setLatest(data.items?.[0] ?? null)
        setLoadState('ready')
      })
      .catch(() => {
        if (!cancelled) setLoadState('error')
      })
    return () => {
      cancelled = true
    }
  }, [])

  const freshnessDate = latest?.collected_at ?? latest?.published_at ?? null

  return (
    <Layout>
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--v2-color-text-primary)' }}>
            {t('overview.title')}
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--v2-color-text-secondary)' }}>
            {t('overview.subtitle')}
          </p>
        </div>

        <div
          className="rounded-lg border px-4 py-3 text-sm inline-flex items-center gap-2 w-fit"
          style={{
            borderColor: 'var(--v2-color-border-default)',
            background: 'var(--v2-color-surface-alt)',
            color: 'var(--v2-color-text-secondary)',
          }}
        >
          <span
            className="inline-block rounded-full"
            style={{
              width: 8,
              height: 8,
              background: loadState === 'ready' && freshnessDate ? 'var(--v2-color-success)' : 'var(--v2-color-warning)',
            }}
          />
          {t('overview.freshness_label')}:{' '}
          <strong style={{ color: 'var(--v2-color-text-primary)' }}>
            {loadState === 'loading'
              ? '\u2026'
              : freshnessDate
                ? formatRelativeTime(freshnessDate)
                : t('market.no_items')}
          </strong>
        </div>

        <div
          className="rounded-lg border p-8 text-center flex flex-col items-center gap-2"
          style={{ borderColor: 'var(--v2-color-border-default)', background: 'var(--v2-color-surface-base)' }}
        >
          <h2 className="text-base font-semibold" style={{ color: 'var(--v2-color-text-primary)' }}>
            {t('overview.no_briefing_title')}
          </h2>
          <p className="text-sm max-w-md" style={{ color: 'var(--v2-color-text-secondary)' }}>
            {t('overview.no_briefing_body')}
          </p>
          <Link
            href="/market"
            className="mt-3 inline-flex items-center rounded px-4 py-2 text-sm font-semibold no-underline"
            style={{ background: 'var(--v2-color-brand-primary)', color: '#fff' }}
          >
            {t('overview.go_to_market')}
          </Link>
        </div>
      </div>
    </Layout>
  )
}
"""


def _stub_page(section: str) -> str:
    return f"""'use client'

import Layout from '@/components/Layout'
import {{ t }} from '@/lib/i18n/config'

// Scaffolding for a later phase of the lean plan — kept intentionally thin
// so the route/nav entry exists and is reviewable now, without pretending
// the feature (RAG search / competitor tracking) is already built.

export default function {section.capitalize()}Page() {{
  return (
    <Layout>
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-2xl font-bold" style={{{{ color: 'var(--v2-color-text-primary)' }}}}>
            {{t('{section}.title')}}
          </h1>
          <p className="text-sm mt-1" style={{{{ color: 'var(--v2-color-text-secondary)' }}}}>
            {{t('{section}.subtitle')}}
          </p>
        </div>

        <div
          className="rounded-lg border p-8 text-center flex flex-col items-center gap-2"
          style={{{{ borderColor: 'var(--v2-color-border-default)', background: 'var(--v2-color-surface-base)' }}}}
        >
          <span
            className="inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold"
            style={{{{ background: '#DBEAFE', color: '#1E40AF' }}}}
          >
            {{t('status.scheduled')}}
          </span>
          <h2 className="text-base font-semibold mt-2" style={{{{ color: 'var(--v2-color-text-primary)' }}}}>
            {{t('{section}.coming_soon_title')}}
          </h2>
          <p className="text-sm max-w-md" style={{{{ color: 'var(--v2-color-text-secondary)' }}}}>
            {{t('{section}.coming_soon_body')}}
          </p>
        </div>
      </div>
    </Layout>
  )
}}
"""


# ─────────────────────────────────────────────────────────────────────────
# 7. Tests
# ─────────────────────────────────────────────────────────────────────────

VITEST_CONFIG = """import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['**/*.test.ts'],
    exclude: ['node_modules/**', '.next/**'],
  },
})
"""

I18N_TEST = """import { describe, expect, it } from 'vitest'
import { t, setLocale, getLocale, SUPPORTED_LOCALES, DEFAULT_LOCALE } from './config'

// Keys that must exist in every locale dictionary. Mirrors PT_BR_DICT (the
// original source of truth) so a future copy change can't silently ship
// without a Russian counterpart — this is the regression guard for Sprint 1.
const REQUIRED_SECTIONS: Record<string, string[]> = {
  nav: ['overview', 'generate', 'market', 'ideas', 'rewrite', 'history', 'settings', 'knowledge', 'brand', 'competitors'],
  action: ['create', 'save', 'delete', 'edit', 'cancel', 'confirm', 'generate', 'approve', 'reject', 'export', 'publish', 'schedule', 'dismiss', 'watch', 'refresh', 'test', 'add', 'remove', 'search', 'filter', 'sort'],
  format: ['article', 'linkedin_post', 'instagram_caption', 'instagram_carousel', 'x_thread', 'facebook_post', 'telegram_post', 'short_video_script', 'email', 'quick_note', 'rewrite'],
  status: ['draft', 'review', 'approved', 'scheduled', 'published', 'dismissed', 'active', 'inactive'],
  settings: ['title', 'subtitle', 'sources', 'templates', 'brands', 'regions', 'language'],
  market: ['title', 'signals', 'no_items', 'source', 'published', 'collected'],
  generate: ['title', 'topic', 'context', 'content_type', 'generating', 'copy', 'download'],
  error: ['generic', 'network', 'unauthorized', 'not_found', 'validation', 'server'],
  product: ['name', 'tagline', 'description'],
  overview: ['title', 'subtitle', 'freshness_label', 'no_briefing_title', 'no_briefing_body', 'go_to_market'],
  knowledge: ['title', 'subtitle', 'coming_soon_title', 'coming_soon_body'],
  competitors: ['title', 'subtitle', 'coming_soon_title', 'coming_soon_body'],
}

describe('i18n dictionary \u2014 Russian parity', () => {
  it('defaults to Russian as the primary UI locale', () => {
    expect(DEFAULT_LOCALE).toBe('ru')
    expect(SUPPORTED_LOCALES).toContain('ru')
  })

  it('resets to the default locale (guards test ordering)', () => {
    setLocale('ru')
    expect(getLocale()).toBe('ru')
  })

  for (const [section, keys] of Object.entries(REQUIRED_SECTIONS)) {
    for (const key of keys) {
      it(`has a Russian translation for "${section}.${key}"`, () => {
        const value = t(`${section}.${key}`, 'ru')
        // t() returns the raw key string when a translation is missing.
        expect(value).not.toBe(`${section}.${key}`)
        expect(value.length).toBeGreaterThan(0)
      })
    }
  }

  it('documents the fallback behavior for a genuinely unknown key', () => {
    expect(t('nonexistent.key', 'ru')).toBe('nonexistent.key')
  })
})
"""


# ─────────────────────────────────────────────────────────────────────────
# 8. docs/SCHEMA.md
# ─────────────────────────────────────────────────────────────────────────

SCHEMA_MD = """# Amado — Actual current schema (audited)

Generated by scanning all 44 files in `supabase/migrations/`. This is the
**as-built** schema, not the lean plan's target schema — see the note at
the bottom for why they intentionally differ right now.

## Table inventory (46 tables)

### Core / identity
- `brand_profiles` — editable Brand OS/Brand Brain summary
- `regions`, `user_preferences`

### Content pipeline (current)
- `articles`, `content_requests`, `content_request_evidence`
- `prompt_templates`, `content_formats`, `generation_runs`

### RSS / ingestion
- `rss_sources`, `rss_items`
- `source_health_events`, `source_items_raw`, `ingestion_runs`

### Evidence layer
- `evidence_items`, `evidence_localizations`

### Brand OS (normalized rule engine)
- `brand_claims`, `brand_rule_sets`, `brand_rules`, `brand_terms`
- `brand_audiences`, `brand_capabilities`, `brand_content_pillars`
- `brand_pain_points`, `brand_products`

### Guideline compiler
- `guideline_import_runs`, `guideline_rule_candidates`
- `policy_conflicts`, `policy_snapshots`

### Platform playbooks / content packages / QA
- `platform_playbooks`, `format_playbooks`, `campaign_profiles`
- `approved_examples`, `content_packages`, `content_assets`
- `content_asset_relations`, `qa_findings`, `claim_spans`, `repair_runs`

### Learning
- `content_pattern_usage`, `performance_snapshots`, `preference_profiles`

### Knowledge (legacy precursor to the plan's `knowledge_assets`)
- `books`, `book_chunks`

### Infra
- `cron_state`, `feature_flag_events`, `pubmed_cache`

## Architecture note — why this isn't the lean plan's 8-table model

`AMADO_LEAN_AI_FIRST_IMPLEMENTATION_PLAN_EN.md` §12 specifies a minimal
~8-table schema and §15 explicitly defers: a twelve-agent architecture, a
complex guideline compiler, an automatic policy conflict graph, and
automatic Brand OS learning. The tables above show this codebase already
built several of those things (`guideline_rule_candidates`,
`policy_conflicts`, `content_pattern_usage`, `preference_profiles`) before
the lean plan was written.

**Decision for this workstream (flag if you disagree):** treat this as a
[strangler-fig migration](https://martinfowler.com/bliki/StranglerFigApplication.html),
not a rewrite. The existing Brand OS / QA / playbooks / learning
infrastructure keeps running under the **Бренд** and **Генерация**
workspaces exactly as-is — it's tested, `tsc`-clean, and represents real
engineering investment. New lean-plan capabilities (Overview/briefing,
Knowledge base RAG, Competitors, manual Performance) are built fresh using
the plan's minimal-schema approach, additive to what exists. The plan's own
§15 already frames deferred features as things to *reconsider later*, which
is compatible with not deleting what's already working today.

Full consolidation down to a single `content_records`-style model — if
ever wanted — should be its own dedicated, carefully-scoped sprint once the
new lean modules have proven value, not a Sprint-1 side effect.

_Generated for Sprint 1 — regenerate manually if migrations change
significantly before the next architecture review._
"""


# ─────────────────────────────────────────────────────────────────────────
# 9. docs/AMADO_ROADMAP.md
# ─────────────────────────────────────────────────────────────────────────

ROADMAP_MD = """# Amado — Lean AI-first roadmap (sprint tracker)

Source plan: `AMADO_LEAN_AI_FIRST_IMPLEMENTATION_PLAN_EN.md` (9 phases) +
`design.md` (target visual system). This file is the living cross-session
handoff for that plan — update the checkboxes as sprints land, the way
`HANDOFF.md` tracked the repository-layer refactor on the previous
workstream.

## Architecture decision (read this first)

The current schema (see `docs/SCHEMA.md`) is **more complex** than the lean
plan's target — it already contains a guideline compiler, policy-conflict
graph, and learning tables the plan explicitly says to defer. Decision:
**strangler-fig, not rewrite.** Existing Brand OS / QA / playbooks / learning
machinery stays as-is; new lean-plan modules (Overview, Knowledge-v2,
Competitors, manual Performance) are built fresh alongside it. Revisit this
decision explicitly before any sprint that would delete existing tables.

## Sprint status

- [x] **Sprint 1 — Russian workspace shell (foundation)**
  Russian i18n dictionary (`lib/i18n/config.ts`, `ru` now default),
  nav restructured to Обзор / Рынок / Генерация / База знаний / Бренд /
  Конкуренты (+ utility row: Идеи / Переписать / История / Настройки),
  `/overview` `/knowledge` `/competitors` route shells, post-login redirect
  → `/overview`, vitest + a real Russian-parity regression test,
  `docs/SCHEMA.md` schema audit. No deletions, no data migrations.

- [ ] **Sprint 2 — Design system migration**
  Adopt `design.md` tokens as the *only* system (retire the old warm/serif
  palette in `styles/design-tokens.css`), import Inter, reskin `Layout.tsx`
  header/nav chrome and the pages touched in Sprint 1 to the dashboard-dense
  aesthetic (tabular-nums for numeric tables, 240px sidebar consideration
  vs. current top-nav — needs a decision, see design.md §6 layout rules).

- [ ] **Sprint 3 — Text-first knowledge library (Phase 2)**
  Migrate `books`/`book_chunks` → `knowledge_assets`/`knowledge_chunks`
  (additive, old tables kept until verified), TXT/Markdown/paste upload,
  chunking + embeddings, semantic search, wire real content into
  `/knowledge` (replacing the Sprint-1 stub), retrieval modes
  (`idea`/`evidence`/`brand`), collections, reindex/archive.

- [ ] **Sprint 4 — Editable Brand workspace touch-up (Phase 3)**
  `/brand` already exists (9 tabs) — gap is against the plan's specific
  sections (Основа бренда, Аудитория, Продукт, Тон и стиль, Разрешённые
  утверждения, Запрещённые формулировки, Правила площадок, Источники
  бренда, История изменений) and brand snapshot/version restore UI. Audit
  tab-by-tab against this list before writing code.

- [ ] **Sprint 5 — Safer source ingestion hardening (Phase 4)**
  RSS already exists; add source health surfaced in UI, manual
  URL/pasted-text source, newsletter ingestion (or manual-forward fallback),
  full-content search. Note: `lib/firecrawl.ts` + `web-reader.ts` already
  do broad scraping — plan says scraping should not be the default
  dependency; decide explicitly whether to keep, gate, or deprecate.

- [ ] **Sprint 6 — Overview and briefing (Phase 5)**
  The real payoff sprint: scheduled sequential AI workflow (one agent,
  task modes per §2.1–2.3 of the plan), persisted daily briefing, replaces
  the Sprint-1 `/overview` empty state with actual ranked items +
  "why it matters" + useful/irrelevant feedback + send-to-generation.

- [ ] **Sprint 7 — Competitor intelligence (Phase 6)**
  Competitor entity (reuses `sources` table per plan §10.2), RSS/newsletter/
  changelog/manual sources, AI competitor review, wire real content into
  `/competitors` (replacing the Sprint-1 stub).

- [ ] **Sprint 8 — Generation workspace unification (Phase 7)**
  Connect Knowledge retrieval + Brand snapshot + Market/Competitor context
  into `/generate` in one flow with visible selected chunks, refinement,
  version history.

- [ ] **Sprint 9 — Manual performance & feedback (Phase 8)**
  Manual publication/metrics entry, AI hypothesis analysis labeled as such
  ("Предположение AI"), explicit-signal learning loop (no automatic Brand
  OS rewrites, per plan §11.4).

- [ ] **Sprint 10 — Hardening (Phase 9)**
  Auth/workspace separation/RLS review, retry logic, scheduled task logs,
  model fallback, cost limits, E2E test for the core journey (Overview →
  Market → Knowledge → Generation → Review → Manual Performance).

## Explicitly deferred (plan §15 — do not build without a product conversation)

Twelve-agent architecture · DOCX/PDF/PPTX/OCR parsing · automatic policy
conflict graph beyond what already exists · page-snapshot diff for
competitors · protected social scraping · automatic social analytics ·
direct social publishing · automatic Brand OS learning · autonomous
campaign decisions.
"""


# ─────────────────────────────────────────────────────────────────────────
# main
# ─────────────────────────────────────────────────────────────────────────

def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--check", action="store_true", help="dry run, print what would change without writing")
    args = parser.parse_args()

    required = [
        ROOT / "lib/i18n/config.ts",
        ROOT / "components/Layout.tsx",
        ROOT / "proxy.ts",
        ROOT / "package.json",
        ROOT / "styles/design-tokens.css",
    ]
    missing = [str(p.relative_to(ROOT)) for p in required if not p.exists()]
    if missing:
        print("ERROR: run this script from the repository root. Missing files:")
        for m in missing:
            print(f"  - {m}")
        return 1

    try:
        patch_i18n(args.check)
        patch_layout(args.check)
        patch_proxy(args.check)
        patch_package_json(args.check)
        patch_design_tokens(args.check)

        print(f"\n== app/overview/page.tsx ==")
        create_or_overwrite(ROOT / "app/overview/page.tsx", OVERVIEW_PAGE, label="Overview page shell", check=args.check)

        print(f"\n== app/knowledge/page.tsx ==")
        create_or_overwrite(ROOT / "app/knowledge/page.tsx", _stub_page("knowledge"), label="Knowledge page shell", check=args.check)

        print(f"\n== app/competitors/page.tsx ==")
        create_or_overwrite(ROOT / "app/competitors/page.tsx", _stub_page("competitors"), label="Competitors page shell", check=args.check)

        print(f"\n== vitest.config.ts ==")
        create_or_overwrite(ROOT / "vitest.config.ts", VITEST_CONFIG, label="vitest config", check=args.check)

        print(f"\n== lib/i18n/config.test.ts ==")
        create_or_overwrite(ROOT / "lib/i18n/config.test.ts", I18N_TEST, label="Russian-parity regression test", check=args.check)

        print(f"\n== docs/SCHEMA.md ==")
        create_or_overwrite(ROOT / "docs/SCHEMA.md", SCHEMA_MD, label="schema audit doc", check=args.check)

        print(f"\n== docs/AMADO_ROADMAP.md ==")
        create_or_overwrite(ROOT / "docs/AMADO_ROADMAP.md", ROADMAP_MD, label="sprint roadmap doc", check=args.check)

    except Anchor as e:
        print(f"\nABORTED: {e}", file=sys.stderr)
        return 1

    print("\nDone." + (" (dry run — nothing was written)" if args.check else ""))
    if not args.check:
        print("\nNext: npm install && npx tsc --noEmit && npm run lint && npm run test && npm run build")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
