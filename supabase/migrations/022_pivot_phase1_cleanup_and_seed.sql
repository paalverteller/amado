-- Phase 1 Pivot: B2C Psychology → B2B Brazil Marketing
-- Cleans old data, seeds new prompt_templates and rss_sources

-- 1. Clean old generated content
DELETE FROM articles;
DELETE FROM rss_items;

-- 2. Clean psychology-specific data (books, chunks)
DELETE FROM book_chunks;
DELETE FROM books;

-- 3. Update prompt_templates: marketing-focused, pt-BR
DELETE FROM prompt_templates;

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

-- 4. Update rss_sources: Brazilian marketing industry sources (Type A)
DELETE FROM rss_sources;

INSERT INTO rss_sources (name, url, country, source_type, active) VALUES
('Meio & Mensagem', 'https://www.meioemensagem.com.br/feed/', 'Brasil', 'rss', true),
('B9', 'https://www.b9.com.br/feed/', 'Brasil', 'rss', true),
('Mundo do Marketing', 'https://www.mundodomarketing.com.br/feed/', 'Brasil', 'rss', true),
('Think with Google Brasil', 'https://www.thinkwithgoogle.com/intl/pt-br/latest-articles/feed/', 'Brasil', 'rss', true),
('Rock Content Blog', 'https://rockcontent.com/br/blog/feed/', 'Brasil', 'rss', true),
('Neil Patel PT', 'https://neilpatel.com/br/blog/feed/', 'Brasil', 'rss', true),
('Resultados Digitais', 'https://resultadosdigitais.com.br/feed/', 'Brasil', 'rss', true),
('Marketing de Conteúdo', 'https://marketingdeconteudo.com/feed/', 'Brasil', 'rss', true);

-- 5. Add prune function if not exists
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
