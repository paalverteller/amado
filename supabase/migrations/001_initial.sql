-- Таблица статей
CREATE TABLE IF NOT EXISTS articles (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at       TIMESTAMPTZ DEFAULT now(),
  topic            TEXT NOT NULL,
  content_type     TEXT CHECK (content_type IN ('article', 'post', 'concept')),
  book_source      TEXT,
  source_context   TEXT,
  draft_content    TEXT,
  final_content    TEXT,
  rating           INTEGER CHECK (rating BETWEEN 1 AND 5),
  comment          TEXT,
  status           TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'reviewed', 'published')),
  published_at     TIMESTAMPTZ,
  tags             TEXT[],
  prompt_version   TEXT,
  generation_model TEXT
);

CREATE INDEX IF NOT EXISTS idx_articles_created_at ON articles (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_articles_status ON articles (status);
CREATE INDEX IF NOT EXISTS idx_articles_rating ON articles (rating);

-- Таблица книг
CREATE TABLE IF NOT EXISTS books (
  id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title     TEXT NOT NULL,
  author    TEXT,
  file_path TEXT NOT NULL,
  added_at  TIMESTAMPTZ DEFAULT now(),
  active    BOOLEAN DEFAULT true
);

-- Таблица RSS источников
CREATE TABLE IF NOT EXISTS rss_sources (
  id     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name   TEXT NOT NULL,
  url    TEXT NOT NULL,
  active BOOLEAN DEFAULT true
);

-- Таблица RSS материалов
CREATE TABLE IF NOT EXISTS rss_items (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id    UUID REFERENCES rss_sources(id) ON DELETE CASCADE,
  title        TEXT,
  description  TEXT,
  link         TEXT UNIQUE,
  published_at TIMESTAMPTZ,
  collected_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rss_items_collected_at ON rss_items (collected_at DESC);
CREATE INDEX IF NOT EXISTS idx_rss_items_source_id ON rss_items (source_id);

-- RLS
ALTER TABLE articles    ENABLE ROW LEVEL SECURITY;
ALTER TABLE books       ENABLE ROW LEVEL SECURITY;
ALTER TABLE rss_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE rss_items   ENABLE ROW LEVEL SECURITY;

-- Политики: полный доступ (личный инструмент, защита на уровне middleware)
CREATE POLICY "allow_all_articles"    ON articles    FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_books"       ON books       FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_rss_sources" ON rss_sources FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_rss_items"   ON rss_items   FOR ALL USING (true) WITH CHECK (true);
