-- 1. Ensure schema strictly matches requirements
ALTER TABLE IF EXISTS articles 
  ADD COLUMN IF NOT EXISTS draft_content TEXT,
  ADD COLUMN IF NOT EXISTS rating INTEGER,
  ADD COLUMN IF NOT EXISTS book_source TEXT,
  ADD COLUMN IF NOT EXISTS source_context TEXT,
  ADD COLUMN IF NOT EXISTS generation_model TEXT;

ALTER TABLE IF EXISTS rss_sources 
  ADD CONSTRAINT rss_sources_url_unique UNIQUE (url);

ALTER TABLE IF EXISTS rss_items 
  ADD CONSTRAINT rss_items_link_unique UNIQUE (link);

-- 2. Clean Mocks
DELETE FROM articles;

-- 3. Seed 10 RSS Sources
INSERT INTO rss_sources (name, url, active) VALUES
('Psychology Today', 'https://www.psychologytoday.com/intl/feed', true),
('Greater Good Magazine', 'https://greatergood.berkeley.edu/feeds/all', true),
('APA', 'https://www.apa.org/news/rss', true),
('Science Daily', 'https://www.sciencedaily.com/rss/mind_brain.xml', true),
('Frontiers', 'https://www.frontiersin.org/journals/psychology/rss', true),
('B17', 'https://www.b17.ru/rss/', true),
('Психологос', 'https://www.psychologos.ru/rss', true),
('Нож', 'https://knife.media/feed/', true),
('Reminder', 'https://reminder.media/feed', true),
('InLiberty', 'https://www.inliberty.ru/feed/' , true)
ON CONFLICT (url) DO NOTHING;

-- 4. Seed 5 Prompt Profiles
DELETE FROM prompt_templates;
INSERT INTO prompt_templates (name, tone_description, system_prompt, content_type) VALUES
('Научно-популярный', 'Точный, доступный, объясняет механизмы', 'Используй научный контекст. Упоминай исследования и школы. Объясняй механизмы. Каждый термин расшифровывай в одном предложении. Тон: доверительный эксперт, не академический сухарь.', 'any'),
('Разговорный', 'Живой, личный, как разговор с другом', 'Пиши как умный друг, который разбирается в психологии. Можно начать с личного наблюдения. Избегай канцелярита. Тон: тёплый, честный, без дистанции.', 'any'),
('Аналитический', 'Структурированный, логичный, с аргументами', 'Строй текст как аргумент. Тезис -> доказательство -> вывод. Используй примеры как доказательства, не украшения. Тон: уверенный, точный, без лишних слов.', 'any'),
('Вдохновляющий', 'Поддерживающий, мотивирующий, человечный', 'Пиши так, чтобы человек после прочтения захотел что-то изменить. Фокус на возможностях, не на проблемах. Тон: тёплый, вселяющий уверенность, без фальши.', 'any'),
('Нарративный', 'Через историю, метафоры, образы', 'Используй истории и метафоры как основной инструмент. Начинай с конкретной сцены. Психология - фон, не главный герой. Тон: образный, живой, кинематографичный.', 'any');
