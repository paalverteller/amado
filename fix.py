# apply_amado_locales_v2.py
from pathlib import Path

ROOT = Path.cwd()


def read(path: str) -> str:
    return (ROOT / path).read_text(encoding="utf-8")


def write(path: str, text: str) -> None:
    target = ROOT / path
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(text, encoding="utf-8")


def replace_once(path: str, old: str, new: str) -> None:
    text = read(path)
    if new in text:
        return
    if old not in text:
        raise RuntimeError(f"{path}: expected anchor not found:\n{old[:240]}")
    write(path, text.replace(old, new, 1))


def replace_all(path: str, replacements: dict[str, str]) -> None:
    text = read(path)
    changed = False
    for old, new in replacements.items():
        if old in text:
            text = text.replace(old, new)
            changed = True
    if changed:
        write(path, text)


# ---------------------------------------------------------------------------
# 1. Locale registry: BR / ES / DE / US
# ---------------------------------------------------------------------------

replace_once(
    "lib/locale.ts",
    """  BR: { locale: 'pt-BR', currency: 'BRL', timezone: 'America/Sao_Paulo' },
  ES: { locale: 'es-ES', currency: 'EUR', timezone: 'Europe/Madrid' },
}""",
    """  BR: { locale: 'pt-BR', currency: 'BRL', timezone: 'America/Sao_Paulo' },
  ES: { locale: 'es-ES', currency: 'EUR', timezone: 'Europe/Madrid' },
  DE: { locale: 'de-DE', currency: 'EUR', timezone: 'Europe/Berlin' },
  US: { locale: 'en-US', currency: 'USD', timezone: 'America/New_York' },
}""",
)

replace_once(
    "lib/prompts.ts",
    """  BR: 'Portuguese (Brazil)',
  ES: 'Spanish (Spain)',
  US: 'English (US)',
  GB: 'English (UK)',""",
    """  BR: 'Portuguese (Brazil)',
  ES: 'Spanish (Spain)',
  DE: 'German (Germany)',
  US: 'English (US)',
  GB: 'English (UK)',""",
)

replace_once(
    "lib/prompts.ts",
    """    'US': 'US market: direct tone, credit card payments, email/SMS channels, US holidays (Thanksgiving, Black Friday, Memorial Day).',
    'GB': 'UK market: polite but direct, GBP currency, British spelling (colour, organise), UK holidays (Boxing Day, Bank Holidays).',
    'ES': 'Spanish market: use "tú" for most brands, "usted" for formal/B2B; Bizum as a common payments mention alongside cards; WhatsApp and Instagram as primary channels; Spanish holidays (Navidad, Rebajas de enero, Black Friday, Reyes Magos on Jan 6); local examples (Madrid, Barcelona, El Corte Inglés). European Spanish, not Latin American (avoid "ustedes" as the only plural, avoid Mexican/Argentine slang).',""",
    """    'US': 'US market: write natural US English. Prefer concise, direct copy, familiar US terminology and US spelling. Use locally relevant examples only when supported by context. Common channels include email, SMS and social platforms. Seasonal references may include Thanksgiving, Black Friday and Memorial Day. Avoid British spelling and translated European phrasing.',
    'GB': 'UK market: polite but direct, GBP currency, British spelling (colour, organise), UK holidays (Boxing Day, Bank Holidays).',
    'ES': 'Spanish market: use "tú" for most brands, "usted" for formal/B2B; Bizum as a common payments mention alongside cards; WhatsApp and Instagram as primary channels; Spanish holidays (Navidad, Rebajas de enero, Black Friday, Reyes Magos on Jan 6); local examples (Madrid, Barcelona, El Corte Inglés). European Spanish, not Latin American (avoid "ustedes" as the only plural, avoid Mexican/Argentine slang).',
    'DE': 'German market: write idiomatic Standard German for Germany. Prefer clear, precise and restrained wording. Use "Sie" by default for formal B2B communication unless the brand voice explicitly requires "du". Use German terminology where it is natural; keep established product and marketing terms only when Germans actually use them. Use German number/date conventions and locally relevant seasonal references. Avoid literal English syntax, exaggerated SaaS claims and Swiss/Austrian variants unless explicitly requested.',""",
)

replace_once(
    "lib/prompts.ts",
    """  const code = ctx.locale === 'es-ES' ? 'ES' : null

  if (code === 'ES') {
    return {
      languageName: ctx.languageName || 'Spanish (Spain)',
      marketAdjective: 'Spanish',
      marketLabel: 'SPANISH MARKET SIGNALS',
      seasonalityExample: 'Spanish dates (Navidad, Rebajas de enero, Reyes Magos on Jan 6)',
    }
  }

  // Any other configured region: use the resolved name/language generically""",
    """  const code =
    ctx.locale === 'es-ES' ? 'ES'
      : ctx.locale === 'de-DE' ? 'DE'
        : ctx.locale === 'en-US' ? 'US'
          : null

  if (code === 'ES') {
    return {
      languageName: ctx.languageName || 'Spanish (Spain)',
      marketAdjective: 'Spanish',
      marketLabel: 'SPANISH MARKET SIGNALS',
      seasonalityExample: 'Spanish dates (Navidad, Rebajas de enero, Reyes Magos on Jan 6)',
    }
  }

  if (code === 'DE') {
    return {
      languageName: ctx.languageName || 'German (Germany)',
      marketAdjective: 'German',
      marketLabel: 'GERMAN MARKET SIGNALS',
      seasonalityExample: 'German dates and seasonal moments relevant to the topic',
    }
  }

  if (code === 'US') {
    return {
      languageName: ctx.languageName || 'English (US)',
      marketAdjective: 'US',
      marketLabel: 'US MARKET SIGNALS',
      seasonalityExample: 'US dates and seasonal moments relevant to the topic',
    }
  }

  // Any other configured region: use the resolved name/language generically""",
)

replace_once(
    "lib/market-context.tsx",
    """  BR: '🇧🇷',
  ES: '🇪🇸',
  MX: '🇲🇽',""",
    """  BR: '🇧🇷',
  ES: '🇪🇸',
  DE: '🇩🇪',
  MX: '🇲🇽',""",
)


# ---------------------------------------------------------------------------
# 2. Market switcher: UI is always Russian, regardless of market locale
# ---------------------------------------------------------------------------

replace_once(
    "components/MarketSwitcher.tsx",
    """import { useMarket, MARKET_FLAGS } from '@/lib/market-context'

/** Dropdown showing""",
    """import { useMarket, MARKET_FLAGS } from '@/lib/market-context'

const MARKET_NAMES_RU: Record<string, string> = {
  BR: 'Бразилия',
  ES: 'Испания',
  DE: 'Германия',
  US: 'США',
  GB: 'Великобритания',
  MX: 'Мексика',
  IT: 'Италия',
}

function marketName(code?: string, fallback?: string): string {
  if (!code) return fallback || 'Бразилия'
  return MARKET_NAMES_RU[code] ?? fallback ?? code
}

/** Dropdown showing""",
)

replace_all(
    "components/MarketSwitcher.tsx",
    {
        "{current?.name ?? 'Brasil'}": "{marketName(current?.code, current?.name)}",
        "<span>{region.name}</span>": "<span>{marketName(region.code, region.name)}</span>",
    },
)


# ---------------------------------------------------------------------------
# 3. Localization API: selected market controls target locale
# ---------------------------------------------------------------------------

replace_once(
    "app/api/localize/route.ts",
    """import { getErrorMessage } from '@/lib/api/error-message'""",
    """import { getErrorMessage } from '@/lib/api/error-message'
import { resolveRegionProfile } from '@/lib/prompts'""",
)

replace_once(
    "app/api/localize/route.ts",
    """  templateId?: string
  brandProfileId?: string
}""",
    """  templateId?: string
  brandProfileId?: string
  regionId?: string
}""",
)

replace_once(
    "app/api/localize/route.ts",
    """const CONTEXT_RULES: Record<NonNullable<Body['contextType']>, string> = {
  ui: 'UI copy: curto, inequívoco, funcional. Priorize ação e escaneabilidade.',
  promo: 'Landing/promo: pode ser mais quente e energético, mas nunca hype genérico.',
  help: 'Help Center: calmo, explícito, passo a passo quando necessário.',
  pricing: 'Pricing: precisão acima de persuasão. Não esconda condições ou limites.',
  legal: 'Legal/compliance: máxima ambiguidade zero. Preserve exatamente obrigações, condições e escopo.',
}""",
    """const CONTEXT_RULES: Record<NonNullable<Body['contextType']>, string> = {
  ui: 'UI copy: concise, unambiguous and functional. Prioritize action and scanability.',
  promo: 'Landing/promo: energetic when appropriate, but never generic hype.',
  help: 'Help content: calm, explicit and step-by-step when useful.',
  pricing: 'Pricing: precision over persuasion. Never hide conditions or limits.',
  legal: 'Legal/compliance: remove ambiguity. Preserve obligations, conditions and scope exactly.',
}

const LOCALE_RULES: Record<string, string> = {
  'pt-BR': `Write native Brazilian Portuguese.
Use modern, direct Brazilian wording and natural sentence structure.
Prefer "você" when direct address is needed, but do not overuse it.
Do not translate English syntax literally.
Avoid generic SaaS clichés and unnecessary anglicisms.
Use established Brazilian digital-product terminology naturally.
The final text must read as if written originally by an excellent Brazilian professional.`,

  'es-ES': `Escribe en español natural de España.
Usa vocabulario, sintaxis y convenciones propias de España, no español latinoamericano.
Prioriza formulaciones claras, directas y profesionales.
Usa "tú" por defecto en comunicación moderna, salvo que el contexto de marca exija "usted".
Evita calcos del inglés, anglicismos innecesarios y clichés de software.
El resultado debe parecer escrito originalmente por un profesional español.`,

  'de-DE': `Schreibe natürliches Standarddeutsch für Deutschland.
Formuliere klar, präzise und professionell, ohne unnötige Werbeübertreibung.
Verwende im B2B-Kontext standardmäßig "Sie", sofern die Markenstimme nicht ausdrücklich "du" vorgibt.
Vermeide wörtliche Übertragungen englischer Satzstrukturen und unnötige Anglizismen.
Nutze Begriffe, die in deutschen digitalen Produkten tatsächlich üblich sind.
Der Text muss wirken, als wäre er ursprünglich von einem deutschen Profi geschrieben worden.`,

  'en-US': `Write natural US English.
Use concise, direct, professional American wording and US spelling.
Avoid translated European syntax, unnecessary jargon and generic SaaS hype.
Prefer familiar interface and marketing terminology used in US digital products.
The final text must read as if it was originally written by an excellent US professional.`,
}""",
)

replace_once(
    "app/api/localize/route.ts",
    """    const template = await resolveTemplate(body.templateId)
    const contextType = body.contextType ?? 'promo'
    const systemPrompt = `${template.prompt}

${CONTEXT_RULES[contextType]}

STRICT EXECUTION CONTRACT:
- Target locale is always Brazilian Portuguese (pt-BR).
- Preserve factual meaning. Never invent facts, offers, dates, legal conditions, metrics or product capabilities.
- Apply the native test before returning.
- Return ONLY the localized final copy. No explanation, no alternatives, no markdown wrapper.`""",
    """    const template = await resolveTemplate(body.templateId)
    const contextType = body.contextType ?? 'promo'
    const regionProfile = await resolveRegionProfile(body.regionId)
    const localeRules = LOCALE_RULES[regionProfile.locale] ?? `Write native ${regionProfile.languageName}.`

    const systemPrompt = `${template.prompt}

IMPORTANT: Any target-market or target-language instruction in the stored template is subordinate to the execution contract below.

TARGET MARKET: ${regionProfile.name}
TARGET LOCALE: ${regionProfile.locale}
TARGET LANGUAGE: ${regionProfile.languageName}

${localeRules}

${CONTEXT_RULES[contextType]}

STRICT EXECUTION CONTRACT:
- The target locale is ${regionProfile.locale}.
- Preserve factual meaning. Never invent facts, offers, dates, legal conditions, metrics or product capabilities.
- Adapt terminology, syntax, register, punctuation, dates and idiom to the target market.
- Apply a native-speaker test before returning.
- Return ONLY the localized final copy. No explanation, no alternatives, no markdown wrapper.`""",
)

replace_once(
    "app/api/localize/route.ts",
    """CONTENT CONTEXT: ${contextType}

SOURCE TEXT:""",
    """CONTENT CONTEXT: ${contextType}
TARGET MARKET: ${regionProfile.name}
TARGET LOCALE: ${regionProfile.locale}

SOURCE TEXT:""",
)


# ---------------------------------------------------------------------------
# 4. Localization workspace: Russian interface + selected market
# ---------------------------------------------------------------------------

replace_once(
    "app/localize/page.tsx",
    """import type { BrandProfile } from '@/lib/domain/brand-profile'""",
    """import type { BrandProfile } from '@/lib/domain/brand-profile'
import { useMarket } from '@/lib/market-context'""",
)

replace_once(
    "app/localize/page.tsx",
    """export default function LocalizePage() {
  const [sourceText, setSourceText] = useState('')""",
    """const TARGET_LOCALES: Record<string, { locale: string; label: string }> = {
  BR: { locale: 'pt-BR', label: 'Бразилия · pt-BR' },
  ES: { locale: 'es-ES', label: 'Испания · es-ES' },
  DE: { locale: 'de-DE', label: 'Германия · de-DE' },
  US: { locale: 'en-US', label: 'США · en-US' },
}

export default function LocalizePage() {
  const { regions, marketCode } = useMarket()
  const currentRegion = regions.find((region) => region.code === marketCode)
  const currentRegionId = currentRegion?.id ?? null
  const target = TARGET_LOCALES[marketCode] ?? { locale: currentRegion?.code ?? marketCode, label: currentRegion?.name ?? marketCode }

  const [sourceText, setSourceText] = useState('')""",
)

# Make brands follow selected market.
replace_once(
    "app/localize/page.tsx",
    """      fetch('/api/brand-profiles', { cache: 'no-store' }).then((r) => r.json()),""",
    """      fetch(currentRegionId ? `/api/brand-profiles?region_id=${encodeURIComponent(currentRegionId)}` : '/api/brand-profiles', { cache: 'no-store' }).then((r) => r.json()),""",
)

replace_once(
    "app/localize/page.tsx",
    """  }, [])

  async function localize() {""",
    """  }, [currentRegionId])

  async function localize() {""",
)

replace_once(
    "app/localize/page.tsx",
    """          brandProfileId: brandId || undefined,
        }),""",
    """          brandProfileId: brandId || undefined,
          regionId: currentRegionId || undefined,
        }),""",
)

replace_all(
    "app/localize/page.tsx",
    {
        "data.error ?? 'Localization failed'": "data.error ?? 'Не удалось локализовать текст'",
        "'Текст локализован на естественный pt-BR.'": "`Текст локализован: ${target.label}.`",
        '<span className="aug-eyebrow">Brazil localization</span>': '<span className="aug-eyebrow">Локализация</span>',
        '<h1 className="mt-3 text-3xl font-extrabold tracking-tight">Локализация → pt-BR</h1>': '<h1 className="mt-3 text-3xl font-extrabold tracking-tight">Локализация · {target.label}</h1>',
        "Не переводим предложение за предложением. Сначала восстанавливаем смысл, контекст и действие, затем пишем текст заново так, как его написал бы бразильский копирайтер.": "Не переводим дословно. Сохраняем смысл и действие, затем переписываем текст естественно для выбранного рынка.",
        "{['Naturalidade > tradução', 'Clareza > criatividade', 'Concreto > abstrato', 'Contexto > slogan'].map((item) => (": "{['Естественность', 'Ясность', 'Конкретика', 'Контекст'].map((item) => (",
        '<option value="en">English</option>': '<option value="en">Английский</option>',
        '<option value="es">Español</option>': '<option value="es">Испанский</option>',
        '<option value="promo">Promo / landing</option>': '<option value="promo">Промо и лендинг</option>',
        '<option value="ui">UI</option>': '<option value="ui">Интерфейс</option>',
        '<option value="help">Help Center</option>': '<option value="help">Справка</option>',
        '<option value="pricing">Pricing</option>': '<option value="pricing">Тарифы</option>',
        '<option value="legal">Legal</option>': '<option value="legal">Юридический текст</option>',
        '<span>Brand OS</span>': '<span>Бренд</span>',
        "{loading ? 'Локализую…' : 'Локализовать на pt-BR'}": "{loading ? 'Локализую…' : `Локализовать · ${target.locale}`}",
        '<span className="aug-eyebrow">Resultado</span>': '<span className="aug-eyebrow">Результат</span>',
        '<h2 className="mt-2 text-xl font-bold">Нативный pt-BR</h2>': '<h2 className="mt-2 text-xl font-bold">{target.label}</h2>',
        "Здесь появится локализованный текст. Amado вернёт только финальный copy — без объяснения процесса.": "Здесь появится локализованный текст. Amado вернёт только готовый вариант без объяснений.",
    },
)


# ---------------------------------------------------------------------------
# 5. Russian-only interface cleanup in currently visible workspaces
# ---------------------------------------------------------------------------

replace_all(
    "app/generate/page.tsx",
    {
        "`Post ${i + 1}/${segments.length}`": "`Пост ${i + 1}/${segments.length}`",
        "`Slide ${i + 1}/${segments.length}`": "`Слайд ${i + 1}/${segments.length}`",
        "Verificação AI": "Проверка текста",
        "SEO-статья · PMEs Brazil": "SEO-статья",
        "Carregando workspace...": "Загрузка…",
    },
)

replace_all(
    "app/market/page.tsx",
    {
        "'Coletando dados…'": "'Собираю данные…'",
        "'Analisando o mercado…'": "'Анализирую рынок…'",
        "'Lendo a imprensa…'": "'Читаю публикации…'",
        "'Verificando fontes…'": "'Проверяю источники…'",
        "'Processando materiais recentes…'": "'Обрабатываю свежие материалы…'",
        "'Coletando contexto para conteúdo futuro…'": "'Собираю контекст…'",
        "'data não informada'": "'дата не указана'",
        "date.toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' })": "date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })",
        "`Fonte: ${item.source.name}. `": "`Источник: ${item.source.name}. `",
        "` Contexto: ${item.description.slice(0, 360)}`": "` Контекст: ${item.description.slice(0, 360)}`",
        "'Não foi possível carregar a análise de mercado'": "'Не удалось загрузить данные рынка'",
        "'Não foi possível coletar dados recentes'": "'Не удалось собрать свежие данные'",
        "'Não foi possível carregar os dados'": "'Не удалось загрузить данные'",
    },
)

replace_all(
    "app/generate/seo/page.tsx",
    {
        "SEO-статья для PMEs Бразилии": "SEO-статья",
        "1.800–3.500 слов · question-based H2 · resumo rápido · реальные evidence из базы Amado · Bitrix24 как естественная operational solution, а не advertorial.": "1 800–3 500 слов · ответы на реальные вопросы · краткое резюме · факты из базы Amado · естественная интеграция продукта без рекламного тона.",
        "<span>Тема / search intent</span>": "<span>Тема и поисковый запрос</span>",
        "<span>Brand OS</span>": "<span>Бренд</span>",
        '<span className="aug-eyebrow">Draft</span>': '<span className="aug-eyebrow">Черновик</span>',
        "Модель: {model} · evidence: {evidenceCount}": "Модель: {model} · источников: {evidenceCount}",
        "После генерации здесь появится черновик. Материал также сохранится в History через основной generation pipeline.": "После генерации здесь появится черновик. Материал также сохранится в истории.",
    },
)

replace_all(
    "app/market/analysis/page.tsx",
    {
        '<span className="aug-eyebrow">Deep Market Intelligence</span>': '<span className="aug-eyebrow">Глубокий анализ рынка</span>',
        "Тренды и бизнес-ландшафт PMEs Бразилии": "Тренды и бизнес-ландшафт",
        "Строго последние 60 дней. Macro, новые бизнес-модели, digital, fintech, государственные программы, риски, поисковые темы и возможности — с traceable evidence из собственной базы Amado.": "Только последние 60 дней. Макроэкономика, бизнес-модели, цифровые продукты, финтех, программы поддержки, риски, поисковые темы и возможности — на основе проверяемых источников из базы Amado.",
        "'Market Intelligence'": "'Анализ рынка'",
        '<span className="aug-eyebrow">Report</span>': '<span className="aug-eyebrow">Отчёт</span>',
        "Brazil SME landscape": "Обзор рынка",
        "' · сохранено в Knowledge'": "' · сохранено в базе знаний'",
        "Модель: {meta.model} · evidence: {meta.evidenceCount ?? 0}": "Модель: {meta.model} · источников: {meta.evidenceCount ?? 0}",
    },
)

replace_all(
    "components/brand/BrandOsEditor.tsx",
    {
        "'Value propositions'": "'Ценность'",
        "'Proof points'": "'Доказательства'",
        "'CTA library'": "'Призывы к действию'",
        "'Legal / disclaimers'": "'Юридические ограничения'",
        "'Общие platform rules'": "'Общие правила площадок'",
        "'Content pillars'": "'Темы контента'",
        "'Vocabulary governance'": "'Терминология'",
        "'Core'": "'Основа'",
        "'Governance'": "'Правила'",
        "'Сохранить core'": "'Сохранить основу'",
        "'Core Brand OS обновлён.'": "'Основа бренда обновлена.'",
        "'Content pillar обновлён.'": "'Тема контента обновлена.'",
    },
)

replace_all(
    "components/settings/PromptStudio.tsx",
    {
        '<span className="aug-eyebrow">Prompt Library</span>': '<span className="aug-eyebrow">Промпты</span>',
        "Канальные правила, локализация, SEO и market analysis хранятся как данные. Их можно менять без deploy и создавать новые профили.": "Правила каналов, локализация, SEO и анализ рынка хранятся как данные. Их можно менять без нового развёртывания.",
        "+ Новый prompt": "+ Новый промпт",
        "'ACTIVE'": "'Активен'",
        "'OFF'": "'Выключен'",
        "Редактировать prompt": "Редактировать промпт",
        "Новый prompt": "Новый промпт",
        'eyebrow="Prompt Library"': 'eyebrow="Промпты"',
        "System prompt применяется перед Brand OS, evidence и контекстом конкретной задачи.": "Системный промпт применяется перед правилами бренда, источниками и контекстом задачи.",
        "Content types · через запятую": "Типы контента · через запятую",
        "<span>System prompt</span>": "<span>Системный промпт</span>",
    },
)

replace_all(
    "components/settings/TemplateCard.tsx",
    {
        "Padrão": "Базовый",
        "Descrição do estilo não disponível.": "Описание не указано.",
        "Usado:": "Использован:",
        " vezes": " раз",
        "Desativar": "Выключить",
        "Ativar": "Включить",
    },
)


# ---------------------------------------------------------------------------
# 6. Add DE + US regions and localized technical brand profiles
# ---------------------------------------------------------------------------

seed = r"""-- Amado — markets DE + US
-- Additive seed. Run through the project's normal Supabase SQL workflow.

BEGIN;

INSERT INTO regions (
  code, name, default_language_code, locale_code,
  currency_code, timezone, search_domain, active
)
VALUES
  ('DE', 'Deutschland', 'de-DE', 'de-DE', 'EUR', 'Europe/Berlin', 'google.de', true),
  ('US', 'United States', 'en-US', 'en-US', 'USD', 'America/New_York', 'google.com', true)
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  default_language_code = EXCLUDED.default_language_code,
  locale_code = EXCLUDED.locale_code,
  currency_code = EXCLUDED.currency_code,
  timezone = EXCLUDED.timezone,
  search_domain = EXCLUDED.search_domain,
  active = true,
  updated_at = now();

DO $$
DECLARE
  v_de UUID;
  v_us UUID;
BEGIN
  SELECT id INTO v_de FROM regions WHERE code = 'DE' LIMIT 1;
  SELECT id INTO v_us FROM regions WHERE code = 'US' LIMIT 1;

  IF v_de IS NULL OR v_us IS NULL THEN
    RAISE EXCEPTION 'DE/US regions were not created';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM brand_profiles WHERE region_id = v_de) THEN
    INSERT INTO brand_profiles (
      brand_name,
      voice_description,
      forbidden_words,
      example_posts,
      target_audience,
      competitors,
      positioning,
      value_propositions,
      strategic_themes,
      product_facts,
      proof_points,
      cta_library,
      legal_disclaimers,
      glossary,
      sensitive_topics,
      default_platform_rules,
      region_id,
      is_active,
      is_default
    ) VALUES (
      'Marke Deutschland',
      'Klares, präzises und professionelles Deutsch für Deutschland. Natürlich formulieren, unnötige Anglizismen und wörtliche Übersetzungen vermeiden. Im B2B-Kontext standardmäßig „Sie“, sofern die Markenregeln nichts anderes vorgeben.',
      '',
      '',
      'In den Markeneinstellungen definieren.',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      v_de,
      true,
      false
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM brand_profiles WHERE region_id = v_us) THEN
    INSERT INTO brand_profiles (
      brand_name,
      voice_description,
      forbidden_words,
      example_posts,
      target_audience,
      competitors,
      positioning,
      value_propositions,
      strategic_themes,
      product_facts,
      proof_points,
      cta_library,
      legal_disclaimers,
      glossary,
      sensitive_topics,
      default_platform_rules,
      region_id,
      is_active,
      is_default
    ) VALUES (
      'US brand',
      'Clear, concise, professional US English. Use natural American wording and US spelling. Avoid generic SaaS hype, unnecessary jargon, and translated European sentence structure.',
      '',
      '',
      'Define in brand settings.',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      v_us,
      true,
      false
    );
  END IF;
END $$;

COMMIT;

SELECT code, name, locale_code, currency_code, timezone, active
FROM regions
WHERE code IN ('BR', 'ES', 'DE', 'US')
ORDER BY code;
"""
write("supabase/seeds/007_germany_us_locales.sql", seed)


# ---------------------------------------------------------------------------
# 7. Regression verification
# ---------------------------------------------------------------------------

checks = {
    "DE locale": ("lib/locale.ts", "DE: { locale: 'de-DE'"),
    "US locale": ("lib/locale.ts", "US: { locale: 'en-US'"),
    "German prompt language": ("lib/prompts.ts", "DE: 'German (Germany)'"),
    "German cultural context": ("lib/prompts.ts", "'DE': 'German market:"),
    "German prompt profile": ("lib/prompts.ts", "marketLabel: 'GERMAN MARKET SIGNALS'"),
    "US prompt profile": ("lib/prompts.ts", "marketLabel: 'US MARKET SIGNALS'"),
    "DE flag": ("lib/market-context.tsx", "DE: '🇩🇪'"),
    "Russian market name": ("components/MarketSwitcher.tsx", "DE: 'Германия'"),
    "Localization region flow": ("app/localize/page.tsx", "regionId: currentRegionId || undefined"),
    "Dynamic localization target": ("app/api/localize/route.ts", "TARGET LOCALE: ${regionProfile.locale}"),
    "German localization contract": ("app/api/localize/route.ts", "'de-DE': `Schreibe natürliches Standarddeutsch"),
    "US localization contract": ("app/api/localize/route.ts", "'en-US': `Write natural US English."),
    "DE/US seed": ("supabase/seeds/007_germany_us_locales.sql", "('DE', 'Deutschland'"),
}

failed = []
for name, (path, needle) in checks.items():
    if needle not in read(path):
        failed.append(f"{name}: {path}")

if failed:
    raise RuntimeError("Verification failed:\n- " + "\n- ".join(failed))

# Guard the most obvious foreign-language UI regressions in edited surfaces.
ui_forbidden = {
    "app/generate/page.tsx": ["Carregando workspace...", "Verificação AI"],
    "app/market/page.tsx": ["Coletando dados…", "data não informada", "Não foi possível carregar os dados"],
    "components/settings/TemplateCard.tsx": ["Padrão", "Desativar", "Ativar"],
    "app/localize/page.tsx": ["Brazil localization", "Resultado", "Help Center", "Pricing"],
}

foreign = []
for path, needles in ui_forbidden.items():
    text = read(path)
    for needle in needles:
        if needle in text:
            foreign.append(f"{path}: {needle}")

if foreign:
    raise RuntimeError("Foreign UI strings remain:\n- " + "\n- ".join(foreign))

print("PASS: Amado locales BR/ES/DE/US")
print("PASS: selected market controls localization target")
print("PASS: Russian-only UI cleanup applied to edited workspaces")
print("PASS: DE/US additive Supabase seed created")