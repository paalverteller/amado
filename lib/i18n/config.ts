/**
 * Amado — i18n Configuration
 * 
 * §14.2: Real message dictionary from the beginning.
 * Stable keys, not source-language strings.
 */

export type Locale = 'pt-BR' | 'en' | 'ru'

export const DEFAULT_LOCALE: Locale = 'ru'
export const SUPPORTED_LOCALES: Locale[] = ['ru', 'pt-BR', 'en']

export const LOCALE_NAMES: Record<Locale, string> = {
  'pt-BR': 'Português (Brasil)',
  'en': 'English',
  'ru': 'Русский',
}

export const LOCALE_LABELS: Record<Locale, string> = {
  'pt-BR': 'PT',
  'en': 'EN',
  'ru': 'RU',
}

// Simple dictionary interface
export type MessageDictionary = Record<string, string | Record<string, string>>

// Current locale (can be made dynamic later with cookies/context)
let _currentLocale: Locale = DEFAULT_LOCALE

export function setLocale(locale: Locale): void {
  if (SUPPORTED_LOCALES.includes(locale)) {
    _currentLocale = locale
  }
}

export function getLocale(): Locale {
  return _currentLocale
}

/**
 * Get a message by key. Supports nested keys with dots.
 * Example: t('nav.generate') → "Geração"
 */
export function t(key: string, locale: Locale = _currentLocale): string {
  const dict = getDictionary(locale)
  const parts = key.split('.')
  
  let current: unknown = dict
  for (const part of parts) {
    if (current && typeof current === 'object' && part in current) {
      current = (current as Record<string, unknown>)[part]
    } else {
      // Fallback to pt-BR
      if (locale !== 'pt-BR') {
        return t(key, 'pt-BR')
      }
      return key // Return key as last resort
    }
  }
  
  return typeof current === 'string' ? current : key
}

function getDictionary(locale: Locale): MessageDictionary {
  switch (locale) {
    case 'en':
      return EN_DICT
    case 'ru':
      return RU_DICT
    case 'pt-BR':
    default:
      return PT_BR_DICT
  }
}

// ─── Portuguese (Brazil) — generated-content language + UI fallback ────────

const PT_BR_DICT: MessageDictionary = {
  // Navigation
  'nav': {
    'brief': 'Brief',
    'signals': 'Sinais',
    'opportunities': 'Oportunidades',
    'studio': 'Studio',
    'pipeline': 'Pipeline',
    'library': 'Biblioteca',
    'settings': 'Configurações',
    'generate': 'Geração',
    'market': 'Mercado',
    'ideas': 'Local Pulse',
    'rewrite': 'Reescrita',
    'history': 'Histórico',
  },
  
  // Common actions
  'action': {
    'create': 'Criar',
    'save': 'Salvar',
    'delete': 'Excluir',
    'edit': 'Editar',
    'cancel': 'Cancelar',
    'confirm': 'Confirmar',
    'generate': 'Gerar',
    'approve': 'Aprovar',
    'reject': 'Rejeitar',
    'export': 'Exportar',
    'publish': 'Publicar',
    'schedule': 'Agendar',
    'dismiss': 'Descartar',
    'watch': 'Observar',
    'refresh': 'Atualizar',
    'test': 'Testar',
    'add': 'Adicionar',
    'remove': 'Remover',
    'search': 'Buscar',
    'filter': 'Filtrar',
    'sort': 'Ordenar',
  },
  
  // Content formats
  'format': {
    'article': 'Artigo',
    'linkedin_post': 'Post LinkedIn',
    'instagram_caption': 'Legenda Instagram',
    'instagram_carousel': 'Carrossel Instagram',
    'x_thread': 'Thread X',
    'facebook_post': 'Post Facebook',
    'telegram_post': 'Post Telegram',
    'short_video_script': 'Roteiro Vídeo Curto',
    'email': 'Email',
    'quick_note': 'Nota Rápida',
    'rewrite': 'Reescrita',
  },
  
  // Statuses
  'status': {
    'draft': 'Rascunho',
    'review': 'Em revisão',
    'approved': 'Aprovado',
    'scheduled': 'Agendado',
    'published': 'Publicado',
    'dismissed': 'Descartado',
    'active': 'Ativo',
    'inactive': 'Inativo',
  },
  
  // Settings
  'settings': {
    'title': 'Configurações',
    'subtitle': 'Gerenciamento de marcas, fontes e templates',
    'sources': 'Fontes de dados',
    'templates': 'Perfis de geração',
    'brands': 'Marcas',
    'regions': 'Regiões',
    'language': 'Idioma',
    'source_name': 'Nome da fonte',
    'source_url': 'URL da fonte',
    'source_type': 'Tipo de conector',
    'source_country': 'País',
    'brand_name': 'Nome da marca',
    'brand_voice': 'Voz da marca',
    'brand_audience': 'Público-alvo',
    'brand_forbidden': 'Palavras proibidas',
    'brand_examples': 'Exemplos de posts',
    'brand_competitors': 'Concorrentes',
    'add_source': 'Adicionar fonte',
    'add_brand': 'Adicionar marca',
    'source_health': 'Saúde da fonte',
    'last_sync': 'Última sincronização',
    'manual': 'Manual',
  },
  
  // Market / Signals
  'market': {
    'title': 'Mercado',
    'signals': 'Sinais',
    'rising': 'Em alta',
    'breaking': 'Urgente',
    'category': 'Categoria',
    'competitors': 'Concorrentes',
    'platform_updates': 'Atualizações de plataforma',
    'campaign_inspiration': 'Inspiração de campanhas',
    'saved': 'Salvos',
    'no_items': 'Nenhum item encontrado',
    'source': 'Fonte',
    'published': 'Publicado',
    'collected': 'Coletado',
  },
  
  // Generation
  'generate': {
    'title': 'Geração',
    'topic': 'Tema',
    'context': 'Contexto',
    'content_type': 'Tipo de conteúdo',
    'template': 'Template',
    'brand_profile': 'Perfil da marca',
    'seo_mode': 'Modo SEO',
    'placeholder_topic': 'Digite o tema do conteúdo...',
    'placeholder_context': 'Contexto adicional (opcional)...',
    'generating': 'Gerando...',
    'regenerate': 'Regenerar',
    'copy': 'Copiar',
    'download': 'Baixar',
  },
  
  // Errors
  'error': {
    'generic': 'Algo deu errado',
    'network': 'Erro de conexão',
    'unauthorized': 'Não autorizado',
    'not_found': 'Não encontrado',
    'validation': 'Dados inválidos',
    'server': 'Erro no servidor',
  },
  
  // Product
  'product': {
    'name': 'Amado',
    'tagline': 'Inteligência e Produção de Conteúdo com IA',
    'description': 'Sistema de inteligência de conteúdo para equipes de marketing regional',
  },
}

// ─── Russian — Primary UI language ──────────────────────────────────────────
// §4 of the lean plan: the product interface is fully Russian. Generated
// market content stays pt-BR (see DEFAULT_LOCALE in lib/locale.ts, which is
// a separate, deliberately-unchanged concept from the UI locale here).

const RU_DICT: MessageDictionary = {
  'nav': {
    'overview': 'Обзор',
    'brief': 'Обзор',
    'signals': 'Рынок',
    'opportunities': 'Идеи',
    'studio': 'Генерация',
    'pipeline': 'История',
    'library': 'База знаний',
    'settings': 'Настройки',
    'generate': 'Генерация',
    'market': 'Рынок',
    'ideas': 'Идеи',
    'rewrite': 'Переписать',
    'history': 'История',
    'knowledge': 'База знаний',
    'brand': 'Бренд',
    'competitors': 'Конкуренты',
    'sources': 'Источники',
    'analytics': 'Аналитика',
  },

  'action': {
    'create': 'Создать',
    'save': 'Сохранить',
    'delete': 'Удалить',
    'edit': 'Изменить',
    'cancel': 'Отмена',
    'confirm': 'Подтвердить',
    'generate': 'Сгенерировать',
    'approve': 'Утвердить',
    'reject': 'Отклонить',
    'export': 'Экспортировать',
    'publish': 'Опубликовать',
    'schedule': 'Запланировать',
    'dismiss': 'Скрыть',
    'watch': 'Отслеживать',
    'refresh': 'Обновить',
    'test': 'Проверить',
    'add': 'Добавить',
    'remove': 'Убрать',
    'search': 'Поиск',
    'filter': 'Фильтр',
    'sort': 'Сортировка',
    'logout': 'Выйти',
  },

  'format': {
    'article': 'Статья',
    'linkedin_post': 'Пост LinkedIn',
    'instagram_caption': 'Подпись Instagram',
    'instagram_carousel': 'Карусель Instagram',
    'x_thread': 'Тред X',
    'facebook_post': 'Пост Facebook',
    'telegram_post': 'Пост Telegram',
    'short_video_script': 'Сценарий короткого видео',
    'email': 'Email',
    'quick_note': 'Быстрая заметка',
    'rewrite': 'Переписанный текст',
  },

  'status': {
    'draft': 'Черновик',
    'review': 'На проверке',
    'approved': 'Утверждено',
    'scheduled': 'Запланировано',
    'published': 'Опубликовано',
    'dismissed': 'Отклонено',
    'active': 'Активно',
    'inactive': 'Неактивно',
  },

  'settings': {
    'title': 'Настройки',
    'subtitle': 'Управление брендами, источниками и шаблонами',
    'sources': 'Источники данных',
    'templates': 'Профили генерации',
    'brands': 'Бренды',
    'regions': 'Регионы',
    'language': 'Язык',
    'source_name': 'Название источника',
    'source_url': 'URL источника',
    'source_type': 'Тип коннектора',
    'source_country': 'Страна',
    'brand_name': 'Название бренда',
    'brand_voice': 'Голос бренда',
    'brand_audience': 'Целевая аудитория',
    'brand_forbidden': 'Запрещённые слова',
    'brand_examples': 'Примеры постов',
    'brand_competitors': 'Конкуренты',
    'add_source': 'Добавить источник',
    'add_brand': 'Добавить бренд',
    'source_health': 'Статус источника',
    'last_sync': 'Последняя синхронизация',
    'manual': 'Вручную',
  },

  'market': {
    'title': 'Рынок',
    'signals': 'Сигналы',
    'rising': 'В тренде',
    'breaking': 'Срочно',
    'category': 'Категория',
    'competitors': 'Конкуренты',
    'platform_updates': 'Обновления платформ',
    'campaign_inspiration': 'Идеи для кампаний',
    'saved': 'Сохранённые',
    'no_items': 'Ничего не найдено',
    'source': 'Источник',
    'published': 'Опубликовано',
    'collected': 'Собрано',
  },

  'generate': {
    'title': 'Генерация',
    'topic': 'Тема',
    'context': 'Контекст',
    'content_type': 'Тип контента',
    'template': 'Шаблон',
    'brand_profile': 'Профиль бренда',
    'seo_mode': 'Режим SEO',
    'placeholder_topic': 'Введите тему материала...',
    'placeholder_context': 'Дополнительный контекст (необязательно)...',
    'generating': 'Генерация...',
    'regenerate': 'Сгенерировать заново',
    'copy': 'Скопировать',
    'download': 'Скачать',
  },

  'error': {
    'generic': 'Что-то пошло не так',
    'network': 'Ошибка соединения',
    'unauthorized': 'Нет доступа',
    'not_found': 'Не найдено',
    'validation': 'Некорректные данные',
    'server': 'Ошибка сервера',
  },

  'product': {
    'name': 'Amado',
    'tagline': 'AI-платформа для рыночной аналитики и контента',
    'description': 'Система рыночной аналитики и генерации контента для маркетинговых команд',
  },

  // ── New workspace shells added in Sprint 1 (Phase 1) ──
  'overview': {
    'title': 'Обзор',
    'subtitle': 'Главное за сегодня',
    'freshness_label': 'Данные обновлены',
    'no_briefing_title': 'Свежих данных пока нет',
    'no_briefing_body': 'Как только появятся важные материалы с рынка, они будут показаны здесь.',
    'active_brand': 'Активный бренд',
    'go_to_market': 'Открыть Рынок',
  },
  'knowledge': {
    'title': 'База знаний',
    'subtitle': 'Внутренние документы, заметки и гайдлайны бренда',
    'coming_soon_title': 'Раздел в разработке',
    'coming_soon_body': 'Загрузка текстов, поиск по базе знаний и использование фрагментов в генерации появятся в одном из ближайших спринтов.',
  },
  'competitors': {
    'title': 'Конкуренты',
    'subtitle': 'Отслеживание обновлений конкурентов',
    'coming_soon_title': 'Раздел в разработке',
    'coming_soon_body': 'Список конкурентов, их источники и сводки обновлений появятся в одном из ближайших спринтов.',
  },
}

// ─── English — Secondary ────────────────────────────────────────────────────

const EN_DICT: MessageDictionary = {
  'nav': {
    'brief': 'Brief',
    'signals': 'Signals',
    'opportunities': 'Opportunities',
    'studio': 'Studio',
    'pipeline': 'Pipeline',
    'library': 'Library',
    'settings': 'Settings',
    'generate': 'Generate',
    'market': 'Market',
    'ideas': 'Local Pulse',
    'rewrite': 'Rewrite',
    'history': 'History',
  },
  'action': {
    'create': 'Create',
    'save': 'Save',
    'delete': 'Delete',
    'edit': 'Edit',
    'cancel': 'Cancel',
    'confirm': 'Confirm',
    'generate': 'Generate',
    'approve': 'Approve',
    'reject': 'Reject',
    'export': 'Export',
    'publish': 'Publish',
    'schedule': 'Schedule',
    'dismiss': 'Dismiss',
    'watch': 'Watch',
    'refresh': 'Refresh',
    'test': 'Test',
    'add': 'Add',
    'remove': 'Remove',
    'search': 'Search',
    'filter': 'Filter',
    'sort': 'Sort',
  },
  'format': {
    'article': 'Article',
    'linkedin_post': 'LinkedIn Post',
    'instagram_caption': 'Instagram Caption',
    'instagram_carousel': 'Instagram Carousel',
    'x_thread': 'X Thread',
    'facebook_post': 'Facebook Post',
    'telegram_post': 'Telegram Post',
    'short_video_script': 'Short Video Script',
    'email': 'Email',
    'quick_note': 'Quick Note',
    'rewrite': 'Rewrite',
  },
  'status': {
    'draft': 'Draft',
    'review': 'In Review',
    'approved': 'Approved',
    'scheduled': 'Scheduled',
    'published': 'Published',
    'dismissed': 'Dismissed',
    'active': 'Active',
    'inactive': 'Inactive',
  },
  'settings': {
    'title': 'Settings',
    'subtitle': 'Manage brands, sources, and templates',
    'sources': 'Data Sources',
    'templates': 'Generation Profiles',
    'brands': 'Brands',
    'regions': 'Regions',
    'language': 'Language',
    'source_name': 'Source Name',
    'source_url': 'Source URL',
    'source_type': 'Connector Type',
    'source_country': 'Country',
    'brand_name': 'Brand Name',
    'brand_voice': 'Brand Voice',
    'brand_audience': 'Target Audience',
    'brand_forbidden': 'Forbidden Words',
    'brand_examples': 'Example Posts',
    'brand_competitors': 'Competitors',
    'add_source': 'Add Source',
    'add_brand': 'Add Brand',
    'source_health': 'Source Health',
    'last_sync': 'Last Sync',
    'manual': 'Manual',
  },
  'market': {
    'title': 'Market',
    'signals': 'Signals',
    'rising': 'Rising',
    'breaking': 'Breaking',
    'category': 'Category',
    'competitors': 'Competitors',
    'platform_updates': 'Platform Updates',
    'campaign_inspiration': 'Campaign Inspiration',
    'saved': 'Saved',
    'no_items': 'No items found',
    'source': 'Source',
    'published': 'Published',
    'collected': 'Collected',
  },
  'generate': {
    'title': 'Generate',
    'topic': 'Topic',
    'context': 'Context',
    'content_type': 'Content Type',
    'template': 'Template',
    'brand_profile': 'Brand Profile',
    'seo_mode': 'SEO Mode',
    'placeholder_topic': 'Enter content topic...',
    'placeholder_context': 'Additional context (optional)...',
    'generating': 'Generating...',
    'regenerate': 'Regenerate',
    'copy': 'Copy',
    'download': 'Download',
  },
  'error': {
    'generic': 'Something went wrong',
    'network': 'Network error',
    'unauthorized': 'Unauthorized',
    'not_found': 'Not found',
    'validation': 'Invalid data',
    'server': 'Server error',
  },
  'product': {
    'name': 'Amado',
    'tagline': 'AI-first Content Intelligence & Production',
    'description': 'Content intelligence system for regional marketing teams',
  },
}
