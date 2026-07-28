-- ══════════════════════════════════════════════════════
-- MIGRATION 009 — Final production fixes
-- Run this in Supabase SQL Editor (copy-paste contents)
-- ══════════════════════════════════════════════════════

-- 1. Add summary_ru column to rss_items
ALTER TABLE rss_items
  ADD COLUMN IF NOT EXISTS summary_ru TEXT;

-- 2. Add word/char count + template link to articles
ALTER TABLE articles
  ADD COLUMN IF NOT EXISTS word_count  INTEGER,
  ADD COLUMN IF NOT EXISTS char_count  INTEGER,
  ADD COLUMN IF NOT EXISTS template_id UUID;

-- 3. Ensure prompt_templates has all required columns
ALTER TABLE prompt_templates
  ADD COLUMN IF NOT EXISTS tone_description TEXT    DEFAULT '',
  ADD COLUMN IF NOT EXISTS is_active        BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS is_default       BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS usage_count      INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS version          TEXT    DEFAULT 'v1.0',
  ADD COLUMN IF NOT EXISTS content_types    TEXT[]
    DEFAULT ARRAY['blog_post','social_post','telegram_post','case_review','article_comment'];

-- 4. Unique constraint on rss_sources.url
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'rss_sources' AND constraint_name = 'rss_sources_url_key'
  ) THEN
    ALTER TABLE rss_sources ADD CONSTRAINT rss_sources_url_key UNIQUE (url);
  END IF;
END $$;

-- 5. Unique constraint on rss_items.link
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'rss_items' AND constraint_name = 'rss_items_link_key'
  ) THEN
    ALTER TABLE rss_items ADD CONSTRAINT rss_items_link_key UNIQUE (link);
  END IF;
END $$;

-- 6. Seed 9 RSS sources
INSERT INTO rss_sources (name, url, active) VALUES
  ('Psychology Today',       'https://www.psychologytoday.com/intl/feed',                  true),
  ('Greater Good Magazine',  'https://greatergood.berkeley.edu/feeds/all',                 true),
  ('APA News',               'https://www.apa.org/news/rss',                               true),
  ('Science Daily Mind',     'https://www.sciencedaily.com/rss/mind_brain.xml',            true),
  ('Frontiers in Psychology','https://www.frontiersin.org/journals/psychology/rss',        true),
  ('B17',                    'https://www.b17.ru/rss/',                                    true),
  ('Психологос',             'https://www.psychologos.ru/rss',                             true),
  ('Нож',                    'https://knife.media/feed/',                                   true),
  ('Reminder',               'https://reminder.media/feed',                                true)
ON CONFLICT (url) DO NOTHING;

-- 7. Seed 5 prompt profiles
INSERT INTO prompt_templates
  (name, tone_description, system_prompt, content_types, is_default, is_active, version)
VALUES
(
  'Научно-популярный',
  'Точный, доступный, объясняет механизмы и ссылается на исследования',
  E'Ты — редактор психологического блога с научным уклоном. Пишешь черновики для психолога-практика.\n\nИспользуй научный контекст. Упоминай исследования и психологические школы. Каждый термин объясняй в одном предложении сразу после введения.\n\nТон: доверительный эксперт — не академический сухарь, не поп-психолог.\n\nСтруктура: заголовок с конкретикой → лид → научный контекст → механизм → практика → вывод.\n\nФОРМАТ: только plain text. Никакого markdown — никаких **, *, #, списков с дефисами. Подзаголовки — отдельная строка с заглавной буквы. Абзацы через пустую строку.\n\nЗАПРЕЩЕНО: директивные советы, клише, AI-маркеры, медицинские диагнозы.',
  ARRAY['blog_post','social_post','telegram_post','case_review','article_comment'],
  true,
  true,
  'scientific-v1.0'
),
(
  'Разговорный',
  'Живой, личный, как разговор с умным другом',
  E'Ты — психолог с живым голосом. Пишешь как умный друг, который глубоко разбирается в психологии.\n\nМожно начать с личного наблюдения или вопроса. Избегай канцелярита, пассивного залога, длинных вводных конструкций.\n\nТон: тёплый, честный, без дистанции и без панибратства.\n\nФОРМАТ: только plain text. Никакого markdown. Абзацы через пустую строку. Никаких списков.\n\nЗАПРЕЩЕНО: "давайте", "мы с вами", академические обороты, AI-маркеры.',
  ARRAY['blog_post','social_post','telegram_post','case_review','article_comment'],
  false,
  true,
  'conversational-v1.0'
),
(
  'Аналитический',
  'Структурированный, логичный, аргументированный',
  E'Ты — аналитический редактор. Строй текст как аргумент: тезис → доказательство → вывод.\n\nКаждый абзац — одна мысль, доведённая до конца. Примеры — доказательства, не украшения.\n\nТон: уверенный, точный, без лишних слов и эмоциональных усилителей.\n\nФОРМАТ: только plain text. Никакого markdown. Абзацы через пустую строку.\n\nЗАПРЕЩЕНО: растекаться мыслью, повторять одно и то же разными словами, AI-маркеры.',
  ARRAY['blog_post','social_post','telegram_post','case_review','article_comment'],
  false,
  true,
  'analytical-v1.0'
),
(
  'Вдохновляющий',
  'Поддерживающий, мотивирующий, человечный',
  E'Ты — вдохновляющий редактор. Фокус на возможностях и росте, не на проблемах и дефицитах.\n\nЧитатель после прочтения должен захотеть что-то попробовать. Никакой фальши и мотивационных клише.\n\nТон: тёплый, вселяющий уверенность, честный о сложностях.\n\nФОРМАТ: только plain text. Никакого markdown. Абзацы через пустую строку.\n\nЗАПРЕЩЕНО: "ты можешь всё", "просто поверь", пустые аффирмации, AI-маркеры.',
  ARRAY['blog_post','social_post','telegram_post','case_review','article_comment'],
  false,
  true,
  'inspiring-v1.0'
),
(
  'Нарративный',
  'Через историю, образы, конкретные сцены',
  E'Ты — нарративный редактор. Психология — фон. Главный герой — живой человек в конкретной ситуации.\n\nНачинай с середины действия: не "сегодня поговорим о...", а с конкретной сцены. Детали создают реальность. Диалог оживляет.\n\nТон: образный, кинематографичный, с психологической глубиной.\n\nФОРМАТ: только plain text. Никакого markdown. Абзацы через пустую строку.\n\nЗАПРЕЩЕНО: мораль в лоб, клише, счастливый конец без заслуги, AI-маркеры.',
  ARRAY['blog_post','social_post','telegram_post','case_review','article_comment'],
  false,
  true,
  'narrative-v1.0'
)
ON CONFLICT (name) DO UPDATE SET
  tone_description = EXCLUDED.tone_description,
  system_prompt    = EXCLUDED.system_prompt,
  is_active        = true,
  version          = EXCLUDED.version;

-- 8. RLS policies (idempotent)
ALTER TABLE rss_items       ENABLE ROW LEVEL SECURITY;
ALTER TABLE prompt_templates ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='prompt_templates' AND policyname='allow_all_templates') THEN
    CREATE POLICY allow_all_templates ON prompt_templates FOR ALL USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='rss_items' AND policyname='allow_all_rss_items') THEN
    CREATE POLICY allow_all_rss_items ON rss_items FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;
