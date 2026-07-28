-- Phase 2: Brand Profiles for B2B Brazil Marketing

CREATE TABLE IF NOT EXISTS brand_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_name TEXT NOT NULL,
  voice_description TEXT NOT NULL DEFAULT '',
  forbidden_words TEXT NOT NULL DEFAULT '',
  example_posts TEXT NOT NULL DEFAULT '',
  target_audience TEXT NOT NULL DEFAULT '',
  competitors TEXT NOT NULL DEFAULT '',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seed: default brand profile
INSERT INTO brand_profiles (brand_name, voice_description, forbidden_words, example_posts, target_audience, competitors)
VALUES (
  'Padrão Brasil',
  'Direto, estratégico, com autoridade mas sem arrogância. Usa exemplos concretos do mercado brasileiro (e-commerce, fintechs, varejo).',
  'sinergia, paradigma, ecossistema, aproveite, não perca',
  'Exemplo 1: "O mercado brasileiro de e-commerce cresceu 23% em 2025. Aqui está o que isso significa para sua marca."
Exemplo 2: "Parcelamento em até 12x não é luxo — é expectativa. 78% dos brasileiros abandonam o carrinho sem essa opção."',
  'Digital marketing managers de empresas internacionais que operam no Brasil',
  'Magazine Luiza, Nubank, iFood'
)
ON CONFLICT DO NOTHING;

-- Add brand_profile_id to articles
ALTER TABLE articles ADD COLUMN IF NOT EXISTS brand_profile_id UUID REFERENCES brand_profiles(id);

-- Add updated_at trigger
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
