-- ============================================================
-- AMADO — B2B Brazil Marketing Content Factory
-- Consolidated init script for fresh Supabase project
-- Run this in Supabase SQL Editor (new project)
-- ============================================================

-- 1. ARTICLES (generated content storage)
CREATE TABLE IF NOT EXISTS articles (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at       TIMESTAMPTZ DEFAULT now(),
  topic            TEXT NOT NULL,
  content_type     TEXT CHECK (content_type IN ('article', 'note', 'social_post', 'thread', 'carousel')),
  source_context   TEXT,
  draft_content    TEXT,
  final_content    TEXT,
  rating           INTEGER CHECK (rating BETWEEN 1 AND 5),
  comment          TEXT,
  status           TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'reviewed', 'published')),
  published_at     TIMESTAMPTZ,
  tags             TEXT[],
  prompt_version   TEXT,
  generation_model TEXT,
  template_id      UUID,
  brand_profile_id UUID,
  word_count       INTEGER,
  char_count       INTEGER
);

CREATE INDEX IF NOT EXISTS idx_articles_created_at ON articles (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_articles_status ON articles (status);
CREATE INDEX IF NOT EXISTS idx_articles_rating ON articles (rating);

-- 2. PROMPT TEMPLATES (generation profiles)
CREATE TABLE IF NOT EXISTS prompt_templates (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at       TIMESTAMPTZ DEFAULT now(),
  name             TEXT NOT NULL,
  tone_description TEXT NOT NULL DEFAULT '',
  system_prompt    TEXT NOT NULL DEFAULT '',
  content_types    TEXT[] NOT NULL DEFAULT '{}',
  is_default       BOOLEAN NOT NULL DEFAULT false,
  is_active        BOOLEAN NOT NULL DEFAULT true,
  usage_count      INTEGER NOT NULL DEFAULT 0,
  version          TEXT NOT NULL DEFAULT 'v1.0'
);

CREATE INDEX IF NOT EXISTS idx_prompt_templates_active ON prompt_templates (is_active);

-- 3. RSS SOURCES (content inspiration feeds)
CREATE TABLE IF NOT EXISTS rss_sources (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  url         TEXT NOT NULL,
  source_type TEXT NOT NULL DEFAULT 'rss',
  country     TEXT NOT NULL DEFAULT 'Brasil',
  active      BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- 4. RSS ITEMS (fetched articles)
CREATE TABLE IF NOT EXISTS rss_items (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id    UUID REFERENCES rss_sources(id) ON DELETE CASCADE,
  title        TEXT,
  title_ru     TEXT,
  description  TEXT,
  summary_ru   TEXT,
  link         TEXT UNIQUE,
  published_at TIMESTAMPTZ,
  collected_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rss_items_collected_at ON rss_items (collected_at DESC);
CREATE INDEX IF NOT EXISTS idx_rss_items_source_id ON rss_items (source_id);

-- 5. BRAND PROFILES (voice/tone configuration)
CREATE TABLE IF NOT EXISTS brand_profiles (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_name        TEXT NOT NULL,
  voice_description TEXT NOT NULL DEFAULT '',
  forbidden_words   TEXT NOT NULL DEFAULT '',
  example_posts     TEXT NOT NULL DEFAULT '',
  target_audience   TEXT NOT NULL DEFAULT '',
  competitors       TEXT NOT NULL DEFAULT '',
  is_active         BOOLEAN NOT NULL DEFAULT true,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Updated_at trigger for brand_profiles
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_brand_profiles_updated_at ON brand_profiles;
CREATE TRIGGER update_brand_profiles_updated_at
  BEFORE UPDATE ON brand_profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 6. RLS POLICIES (open access — auth via app middleware)
ALTER TABLE articles         ENABLE ROW LEVEL SECURITY;
ALTER TABLE prompt_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE rss_sources      ENABLE ROW LEVEL SECURITY;
ALTER TABLE rss_items        ENABLE ROW LEVEL SECURITY;
ALTER TABLE brand_profiles   ENABLE ROW LEVEL SECURITY;

CREATE POLICY "allow_all_articles"         ON articles         FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_prompt_templates" ON prompt_templates FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_rss_sources"      ON rss_sources      FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_rss_items"        ON rss_items        FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_brand_profiles"   ON brand_profiles   FOR ALL USING (true) WITH CHECK (true);

-- ============================================================
-- SEED DATA
-- ============================================================

-- Seed: Default prompt templates (B2B Brazil Marketing)
INSERT INTO prompt_templates (name, tone_description, system_prompt, content_types, is_default, is_active, usage_count, version)
VALUES (
  'Marketing Brasil — Padrão',
  'Especialista em marketing digital para o mercado brasileiro. Tom direto, estratégico, com CTA sempre presente.',
  '<role>Especialista sênior de marketing digital com 10+ anos no mercado brasileiro. Você entende nuances culturais, gírias regionais aceitáveis, e sabe adaptar conteúdo global para soar autêntico no Brasil.</role>
<voice>Direto, estratégico, com autoridade mas sem arrogância. Usa exemplos concretos do mercado brasileiro (e-commerce, fintechs, varejo). Evita linguagem corporativa genérica.</voice>
<forbidden>linguagem corporativa genérica ("sinergia", "paradigma", "ecossistema" sem contexto); tradução literal do inglês; clichês de marketing ("aproveite", "não perca" sem contexto); ausência de CTA</forbidden>
<format>Texto puro. Parágrafos curtos (3-4 frases). Subtítulos em nova linha, sem markdown. CTA claro no final.</format>
<language>pt-BR</language>
<brazil_specific>
- Parcelamento ("em até 12x") é culturalmente essencial em copy de e-commerce
- WhatsApp é o canal principal de comunicação — mencionar quando relevante
- Regionalismo: "trem" (MG), "rapaz" (Nordeste), "mano" (SP) — usar com cuidado e contexto
- Sazonalidade: Carnaval, Dia das Mães, Black Friday Brasil (novembro), Dia do Consumidor
</brazil_specific>',
  ARRAY['article', 'note', 'social_post', 'thread', 'carousel'],
  true,
  true,
  0,
  'v1.0_br_marketing'
);

INSERT INTO prompt_templates (name, tone_description, system_prompt, content_types, is_default, is_active, usage_count, version)
VALUES (
  'Marketing Brasil — Técnico/SEO',
  'Foco em conteúdo técnico, SEO para Google.com.br, otimização de conversão.',
  '<role>Especialista em SEO e CRO para o mercado brasileiro. Foco em dados, métricas, e otimização para Google.com.br.</role>
<voice>Técnico mas acessível. Usa dados e estatísticas quando possível. Estrutura clara com subtítulos.</voice>
<forbidden>especulação sem dados; promessas irreais ("garantido", "100%"); ignorar mobile-first indexing</forbidden>
<format>Texto puro com subtítulos descritivos. Parágrafos curtos. Lista de keywords no final quando relevante.</format>
<language>pt-BR</language>
<seo_rules>
- Google.com.br: intento de busca local é diferente ("preço" vs "price", "parcelamento" é crucial)
- Instagram/TikTok SEO: hashtags estratégicas no final do post
- E-E-A-T: citar fontes, dados concretos, exemplos reais do mercado BR
- Estrutura: hook nos primeiros 125 caracteres, subtítulo a cada 300-400 palavras
</seo_rules>',
  ARRAY['article', 'note', 'social_post'],
  false,
  true,
  0,
  'v1.0_br_seo'
);

-- Seed: RSS sources (Brazilian marketing)
INSERT INTO rss_sources (name, url, country, source_type, active) VALUES
('Meio & Mensagem', 'https://www.meioemensagem.com.br/feed/', 'Brasil', 'rss', true),
('B9', 'https://www.b9.com.br/feed/', 'Brasil', 'rss', true),
('Mundo do Marketing', 'https://www.mundodomarketing.com.br/feed/', 'Brasil', 'rss', true),
('Think with Google Brasil', 'https://www.thinkwithgoogle.com/intl/pt-br/latest-articles/feed/', 'Brasil', 'rss', true),
('Rock Content Blog', 'https://rockcontent.com/br/blog/feed/', 'Brasil', 'rss', true),
('Neil Patel PT', 'https://neilpatel.com/br/blog/feed/', 'Brasil', 'rss', true),
('Resultados Digitais', 'https://resultadosdigitais.com.br/feed/', 'Brasil', 'rss', true),
('Marketing de Conteúdo', 'https://marketingdeconteudo.com/feed/', 'Brasil', 'rss', true);

-- Seed: Default brand profile
INSERT INTO brand_profiles (brand_name, voice_description, forbidden_words, example_posts, target_audience, competitors)
VALUES (
  'Padrão Brasil',
  'Direto, estratégico, com autoridade mas sem arrogância. Usa exemplos concretos do mercado brasileiro (e-commerce, fintechs, varejo).',
  'sinergia, paradigma, ecossistema, aproveite, não perca',
  'Exemplo 1: "O mercado brasileiro de e-commerce cresceu 23% em 2025. Aqui está o que isso significa para sua marca."
Exemplo 2: "Parcelamento em até 12x não é luxo — é expectativa. 78% dos brasileiros abandonam o carrinho sem essa opção."',
  'Digital marketing managers de empresas internacionais que operam no Brasil',
  'Magazine Luiza, Nubank, iFood'
);

-- Helper: prune function for RSS items
CREATE OR REPLACE FUNCTION prune_market_rss_items_keep_latest_50()
RETURNS void AS $$
BEGIN
  DELETE FROM rss_items
  WHERE id NOT IN (
    SELECT id FROM rss_items
    ORDER BY collected_at DESC
    LIMIT 50
  );
END;
$$ LANGUAGE plpgsql;
