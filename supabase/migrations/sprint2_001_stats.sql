-- Sprint 2: link articles to templates + word count column

ALTER TABLE articles
  ADD COLUMN IF NOT EXISTS template_id   UUID REFERENCES prompt_templates(id),
  ADD COLUMN IF NOT EXISTS word_count    INTEGER,
  ADD COLUMN IF NOT EXISTS char_count    INTEGER;

CREATE INDEX IF NOT EXISTS idx_articles_template_id ON articles (template_id);

-- View: daily generation counts (used by stats dashboard)
CREATE OR REPLACE VIEW articles_daily_stats AS
SELECT
  DATE_TRUNC('day', created_at) AS day,
  COUNT(*)                       AS total,
  AVG(rating)                    AS avg_rating,
  COUNT(*) FILTER (WHERE status = 'published') AS published_count
FROM articles
GROUP BY DATE_TRUNC('day', created_at)
ORDER BY day DESC;
