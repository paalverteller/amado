-- Amado — Germany + US locale expansion
-- Additive seed. Execute in Supabase SQL Editor after applying the code patch.

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

  INSERT INTO brand_profiles (
    brand_name, voice_description, forbidden_words, example_posts,
    target_audience, competitors, region_id, is_active, is_default
  )
  SELECT
    'Marke Deutschland (placeholder)',
    'PLATZHALTER — vor der echten Content-Erstellung unter Einstellungen → Brand ausfüllen. Vorläufiger Ton: klar, präzise und professionell, ohne unnötige Anglizismen oder übertriebene SaaS-Sprache.',
    '', '', 'In den Markeneinstellungen definieren.', '', v_de, true, false
  WHERE NOT EXISTS (SELECT 1 FROM brand_profiles WHERE region_id = v_de);

  INSERT INTO brand_profiles (
    brand_name, voice_description, forbidden_words, example_posts,
    target_audience, competitors, region_id, is_active, is_default
  )
  SELECT
    'US brand (placeholder)',
    'PLACEHOLDER — complete the brand settings before generating real content. Provisional voice: clear, concise and professional US English without generic SaaS hype or unnecessary jargon.',
    '', '', 'Define in brand settings.', '', v_us, true, false
  WHERE NOT EXISTS (SELECT 1 FROM brand_profiles WHERE region_id = v_us);
END $$;

ALTER TABLE user_preferences
  ALTER COLUMN interface_locale SET DEFAULT 'ru';

UPDATE user_preferences
SET interface_locale = 'ru'
WHERE interface_locale IS DISTINCT FROM 'ru';

COMMIT;

SELECT code, name, locale_code, currency_code, timezone, active
FROM regions
WHERE code IN ('BR', 'ES', 'DE', 'US')
ORDER BY code;

SELECT brand_name, region_id, is_active, is_default
FROM brand_profiles
WHERE region_id IN (SELECT id FROM regions WHERE code IN ('DE', 'US'))
ORDER BY brand_name;
