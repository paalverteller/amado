-- Amado Sprint 2 — Seed Bitrix24 Brazil Brand Policy
-- 
-- §5: Normalized Bitrix24 Brazil brand model
-- §8.8: Seed the reviewed normalized model
-- 
-- This migration seeds DRAFT state. Human approval required for activation.

-- ─── 1. Ensure Brazil region exists ─────────────────────────────────────────

INSERT INTO regions (code, name, default_language_code, locale_code, currency_code, timezone, active)
VALUES ('BR', 'Brasil', 'pt-BR', 'pt-BR', 'BRL', 'America/Sao_Paulo', true)
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  active = true;

-- ─── 2. Create Bitrix24 Brazil brand profile if not exists ──────────────────

INSERT INTO brand_profiles (
  brand_name, voice_description, forbidden_words, example_posts,
  target_audience, competitors, is_active, is_default,
  positioning, value_propositions, strategic_themes,
  product_facts, proof_points, cta_library,
  legal_disclaimers, glossary, sensitive_topics,
  default_platform_rules
)
VALUES (
  'Bitrix24 Brasil',
  'Pragmático, humano, direto, levemente provocativo. Voz de quem entende o dia a dia do negócio brasileiro. Sem jargon corporativo. Sem hype.',
  'solução única, sucesso garantido, o melhor, perfeito, revolucionário, oferta imperdível, resultado garantido, crescimento garantido, compre agora, não perca, última chance, comente "EU QUERO", transformação digital, ecossistema inovador, jornada, potencializar, alavancar, sinergia, performance máxima, growth hacking, game changer, escala exponencial',
  'Exemplo 1: "Sua empresa perde dinheiro porque o trabalho está espalhado no WhatsApp, Excel e memória de uma pessoa. Bitrix24 centraliza tudo."
Exemplo 2: "O cliente mandou áudio de 14 minutos. Sua equipe não sabe quem responde. Isso é caixa operacional — não falta de esforço."',
  'Donos de pequenas e médias empresas brasileiras, fundadores, gestores de vendas, gestores de operações, donos de agências, consultores, gestores de projetos, empreendedores solo',
  'HubSpot, Pipedrive, Monday.com, Notion, Trello, Asana, ClickUp, Salesforce (enterprise)',
  true,
  true,
  'Sistema operacional para negócios reais no Brasil. Ajuda empresas a parar de perder dinheiro porque o trabalho está espalhado e depende da memória de uma pessoa.',
  'Torna o trabalho visível, registrado, atribuído, lembrado e acompanhado',
  'caos operacional, gargalo do fundador, vendas e CRM, delegação e clareza de tarefas, comportamento WhatsApp e Excel, exaustão humana e troca de contexto, IA e automação prática, psicologia de negócios, educação de categoria, realidade do PME brasileiro',
  'CRM completo, pipeline de vendas, tarefas e projetos, automação, aprovações e fluxos de trabalho, chat interno, calendário, documentos, checklists, Contact Center, histórico do cliente, analytics, CoPilot / assistência de IA',
  'Mais de 12 milhões de usuários mundiais, presente no Brasil há mais de 10 anos, usado por PMEs de todos os setores',
  'Organize. Integre. Automatize. Delegue. Estruture. Lembre-se. Acompanhe. Venda. Resolva.',
  'Não invente números, clientes, resultados ou garantias. Respeite a LGPD. Indique parcerias pagas. Use reivindicações qualificadas apenas.',
  'CRM: gestão de relacionamento com cliente. Pipeline: visualização do funil de vendas. Follow-up: acompanhamento de leads. Caos operacional: quando processos dependem de memória individual.',
  'Conteúdo com dados pessoais reais requer aprovação legal. Conteúdo de parceiros requer divulgação. Nunca invente depoimentos ou resultados.'
)
ON CONFLICT DO NOTHING;

-- Get the brand ID
DO $$
DECLARE
  v_brand_id UUID;
BEGIN
  SELECT id INTO v_brand_id FROM brand_profiles WHERE brand_name = 'Bitrix24 Brasil' LIMIT 1;
  
  IF v_brand_id IS NULL THEN
    RAISE NOTICE 'Bitrix24 Brasil brand profile not found, skipping seed';
    RETURN;
  END IF;

  -- ─── 3. Seed content pillars ──────────────────────────────────────────────

  INSERT INTO brand_content_pillars (brand_id, name, purpose, default_product_explicitness, risk_level, sort_order)
  VALUES
    (v_brand_id, 'Caos Operacional', 'Diagnosticar e nomear problemas do dia a dia', 'late_light', 'low', 1),
    (v_brand_id, 'Gargalo do Fundador', 'Mostrar como o dono vira escolha de gargalo', 'late_light', 'low', 2),
    (v_brand_id, 'Vendas e CRM', 'Educação sobre pipeline e follow-up', 'explicit_product', 'low', 3),
    (v_brand_id, 'Delegação e Clareza', 'Como distribuir tarefas com responsabilidade', 'late_light', 'low', 4),
    (v_brand_id, 'WhatsApp e Excel', 'Comportamentos brasileiros que prejudicam', 'implicit', 'low', 5),
    (v_brand_id, 'Exaustão e Troca de Contexto', 'Custo humano da fragmentação', 'none', 'medium', 6),
    (v_brand_id, 'IA e Automação Prática', 'Uso real de IA para operações', 'explicit_product', 'low', 7),
    (v_brand_id, 'Psicologia de Negócios', 'Comportamento organizacional brasileiro', 'none', 'medium', 8),
    (v_brand_id, 'Educação de Categoria', 'O que é um CRM, pipeline, etc.', 'late_light', 'low', 9),
    (v_brand_id, 'Realidade do PME Brasileiro', 'Cenários específicos do mercado local', 'implicit', 'low', 10),
    (v_brand_id, 'Trabalho Remoto e Híbrido', 'Desafios de gestão à distância', 'late_light', 'low', 11),
    (v_brand_id, 'Infraestrutura do Produto', 'Como o Bitrix24 funciona por trás', 'explicit_product', 'low', 12),
    (v_brand_id, 'Prova Social e Casos', 'Resultados reais de clientes', 'explicit_product', 'medium', 13),
    (v_brand_id, 'Conteúdo com Pessoas', 'Histórias de quem usa', 'implicit', 'low', 14),
    (v_brand_id, 'Tendências e Bastidores', 'O que está acontecendo no mercado', 'none', 'low', 15)
  ON CONFLICT DO NOTHING;

  -- ─── 4. Seed pain points ──────────────────────────────────────────────────

  INSERT INTO brand_pain_points (brand_id, canonical_name, description, approved_brazilian_examples)
  VALUES
    (v_brand_id, 'WhatsApp como sede da empresa', 'Toda comunicação depende de grupos de WhatsApp sem estrutura', ARRAY['grupo silenciado desde janeiro', 'áudio de 14 minutos no WhatsApp', 'print enviado sem contexto']),
    (v_brand_id, 'Excel como dependência operacional', 'Planilhas controlam processos críticos', ARRAY['planilha chamada final_v7_agora_vai', 'Excel travou e ninguém sabe a senha']),
    (v_brand_id, 'Follow-up depende de memória', 'Ninguém lembra de retornar para o cliente', ARRAY['cliente esperando resposta desde sexta', 'proposta perdida no e-mail', 'boleto que ninguém cobrou']),
    (v_brand_id, 'Tarefas sem dono', 'Responsabilidades não são atribuídas', ARRAY['"só mais uma coisa" do cliente', 'reunião marcada às 17h58', 'notificação domingo à noite']),
    (v_brand_id, 'Aprovações enterradas em conversas', 'Decisões ficam perdidas em threads', ARRAY['áudio ouvido em 1.5x', 'dono respondendo cliente no almoço']),
    (v_brand_id, 'Histórico do cliente preso no celular', 'Quando o vendedor sai, leva tudo na cabeça', ARRAY['vendedor que saiu e levou o histórico na cabeça', 'cliente ligou e ninguém sabia do que se tratava']),
    (v_brand_id, 'Fundador como CRM', 'O dono é o sistema operacional humano', ARRAY['fundador é o lembrete ambulante', 'só o dono sabe onde as coisas estão'])
  ON CONFLICT DO NOTHING;

  -- ─── 5. Seed campaign profiles ────────────────────────────────────────────

  INSERT INTO campaign_profiles (brand_id, name, description, default_objective, cta_policy, product_explicitness, proof_requirement, risk_flags)
  VALUES
    (v_brand_id, 'Insight Orgânico', 'Conteúdo de valor puro, sem venda direta', 'trust', 'reflection', 'none', 'none', ARRAY['none']),
    (v_brand_id, 'Educação', 'Ensinar conceitos e práticas', 'saves', 'save', 'late_light', 'preferred', ARRAY['none']),
    (v_brand_id, 'Lançamento de Produto', 'Nova funcionalidade ou atualização', 'leads', 'deep_link', 'explicit_product', 'required', ARRAY['none']),
    (v_brand_id, 'Comercial / Resposta Direta', 'Campanha com objetivo de conversão', 'leads', 'whatsapp', 'explicit_product', 'required', ARRAY['paid_partnership']),
    (v_brand_id, 'Data / Evento Nacional', 'Conteúdo relacionado a datas comemorativas', 'reach', 'none', 'none', 'none', ARRAY['none']),
    (v_brand_id, 'Conteúdo de Parceiro', 'Conteúdo em parceria com outra marca', 'reach', 'deep_link', 'late_light', 'preferred', ARRAY['paid_partnership']),
    (v_brand_id, 'Preview de Conteúdo', 'Antevisão de webinar, podcast ou material', 'registrations', 'deep_link', 'implicit', 'none', ARRAY['none']),
    (v_brand_id, 'Thought Leadership', 'Opinião e visão de liderança', 'shares', 'comment', 'none', 'none', ARRAY['none'])
  ON CONFLICT DO NOTHING;

  -- ─── 6. Seed brand terms (forbidden and preferred) ────────────────────────

  INSERT INTO brand_terms (brand_id, locale, term, normalized_term, policy, replacement, notes)
  VALUES
    -- Forbidden
    (v_brand_id, 'pt-BR', 'solução única', 'solucao unica', 'forbidden', NULL, 'Nunca use'),
    (v_brand_id, 'pt-BR', 'sucesso garantido', 'sucesso garantido', 'forbidden', NULL, 'Nunca use'),
    (v_brand_id, 'pt-BR', 'o melhor', 'o melhor', 'forbidden', NULL, 'Nunca use'),
    (v_brand_id, 'pt-BR', 'perfeito', 'perfeito', 'forbidden', NULL, 'Nunca use'),
    (v_brand_id, 'pt-BR', 'revolucionário', 'revolucionario', 'forbidden', NULL, 'Nunca use'),
    (v_brand_id, 'pt-BR', 'oferta imperdível', 'oferta imperdivel', 'forbidden', NULL, 'Nunca use'),
    (v_brand_id, 'pt-BR', 'resultado garantido', 'resultado garantido', 'forbidden', NULL, 'Nunca use'),
    (v_brand_id, 'pt-BR', 'compre agora', 'compre agora', 'forbidden', NULL, 'Nunca use'),
    (v_brand_id, 'pt-BR', 'não perca', 'nao perca', 'forbidden', NULL, 'Nunca use'),
    (v_brand_id, 'pt-BR', 'última chance', 'ultima chance', 'forbidden', NULL, 'Nunca use'),
    (v_brand_id, 'pt-BR', 'transformação digital', 'transformacao digital', 'forbidden', NULL, 'Evite'),
    (v_brand_id, 'pt-BR', 'ecossistema inovador', 'ecossistema inovador', 'forbidden', NULL, 'Evite'),
    (v_brand_id, 'pt-BR', 'jornada', 'jornada', 'forbidden', NULL, 'Evite'),
    (v_brand_id, 'pt-BR', 'potencializar', 'potencializar', 'forbidden', NULL, 'Evite'),
    (v_brand_id, 'pt-BR', 'alavancar', 'alavancar', 'forbidden', NULL, 'Evite'),
    (v_brand_id, 'pt-BR', 'sinergia', 'sinergia', 'forbidden', NULL, 'Evite'),
    (v_brand_id, 'pt-BR', 'growth hacking', 'growth hacking', 'forbidden', NULL, 'Evite'),
    (v_brand_id, 'pt-BR', 'game changer', 'game changer', 'forbidden', NULL, 'Evite'),
    -- Preferred
    (v_brand_id, 'pt-BR', 'organizar', 'organizar', 'preferred', NULL, 'Verbo preferido'),
    (v_brand_id, 'pt-BR', 'integrar', 'integrar', 'preferred', NULL, 'Verbo preferido'),
    (v_brand_id, 'pt-BR', 'automatizar', 'automatizar', 'preferred', NULL, 'Verbo preferido'),
    (v_brand_id, 'pt-BR', 'delegar', 'delegar', 'preferred', NULL, 'Verbo preferido'),
    (v_brand_id, 'pt-BR', 'estruturar', 'estruturar', 'preferred', NULL, 'Verbo preferido'),
    (v_brand_id, 'pt-BR', 'lembrar', 'lembrar', 'preferred', NULL, 'Verbo preferido'),
    (v_brand_id, 'pt-BR', 'acompanhar', 'acompanhar', 'preferred', NULL, 'Verbo preferido'),
    (v_brand_id, 'pt-BR', 'vender', 'vender', 'preferred', NULL, 'Verbo preferido'),
    (v_brand_id, 'pt-BR', 'resolver', 'resolver', 'preferred', NULL, 'Verbo preferido'),
    (v_brand_id, 'pt-BR', 'centralizar', 'centralizar', 'preferred', NULL, 'Verbo preferido')
  ON CONFLICT DO NOTHING;

  -- ─── 7. Create initial draft rule set ─────────────────────────────────────

  INSERT INTO brand_rule_sets (workspace_id, brand_id, name, version, status)
  VALUES ('00000000-0000-0000-0000-000000000000', v_brand_id, 'Bitrix24 Brasil Política Inicial', 'v1.0-draft', 'draft')
  ON CONFLICT DO NOTHING;

END $$;

-- ─── 8. Comments ────────────────────────────────────────────────────────────

COMMENT ON TABLE brand_content_pillars IS 'Bitrix24 Brazil content pillars — seeded as draft, requires human review';
COMMENT ON TABLE brand_pain_points IS 'Bitrix24 Brazil pain points with Brazilian examples';
COMMENT ON TABLE campaign_profiles IS 'Bitrix24 Brazil campaign profiles with default CTA and product explicitness';
COMMENT ON TABLE brand_terms IS 'Bitrix24 Brazil vocabulary governance — forbidden and preferred terms';
