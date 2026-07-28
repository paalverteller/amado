<div align="center">
  <img src="public/icon.svg" alt="Купала Логотип" width="100"/>
  <h1>🏭 Контент-фабрика «Янка Купала»</h1>
  <p><b>Мощная AI-машина для написания авторских психологических лонгридов и постов.</b><br>
  Сканирует мировой рынок прессы, спасает от таймаутов, сама избегает вымышленных кейсов и выдерживает корпоративный лимит по символам.</p>

  <div>
    <img src="https://img.shields.io/badge/Next.js-16.2.6-black?style=for-the-badge&logo=next.js" />
    <img src="https://img.shields.io/badge/OpenAI-2026%20Tier-412991?style=for-the-badge&logo=openai" />
    <img src="https://img.shields.io/badge/Google-Gemini%203.5-ea4335?style=for-the-badge&logo=google" />
    <img src="https://img.shields.io/badge/Groq-Cloud-f3f4f6?style=for-the-badge" />
    <img src="https://img.shields.io/badge/Supabase-Database-3ecf8e?style=for-the-badge&logo=supabase" />
  </div>
</div>

<br/>

## 🌟 Возможности проекта

*   **Self-Healing AI Infrastructure**
    Сервер работает на лимитах Vercel. Хэш-балансировщик аккуратно разбрасывает нагрузку (Load Balancing) на топовые флагманы *gpt-5.5, gemini-3.5-flash, o3* (генерация). При ошибках `429 Insufficient Quota` включается жесткий cooldown 24ч и запрос подхватывает безотказный хвост `llama-4` и `qwen3`. Функция никогда не падает!
*   **Иммерсивный сбор прессы**
    Встроена интеллектуальная машина для чтения научных новостей мира: Англия (BPS Digest), США, Бразилия, Япония и Германия. 
    Использует агрессивные RegEx парсеры — ноль вакансий, редакционной болтовни или реклам. Только "говядина" научной фактуры! Иероглифический блок отключил ИИ галлюцинации Qwen.
*   **Автономность 72-часа**
    Приложение живет без помощи человека благодаря двум Vercel-кронам: не дает базе уходить в `Sleep-mode` (`0 0 */5 * *`) и самостоятельно загружает + переводит ленту ночью (`0 3 */3 * *`). Утром готов свежий русскоязычный рынок трендов.
*   **Без вымышленного опыта (Zero Hallucination Tone)**
    Скрытая директива блокирует проявление синдрома ИИ ("На днях я пила чай с клиентом и поняла..."). Статьи генерируются сухо, мощно и на базе фактуры. Строго до **2500 символов**.

<details>
<summary><b>🛠 Конфигурация: Установка и Запуск</b></summary>
<br>

Вам потребуется ключи от: Google AI Studio, OpenAI, Groq, DeepSeek (Опционально).

1. Скачайте проект 
2. Установите зависимости через `npm install`
3. Подкиньте `.env.local` на основе списка ключей: `GOOGLE_GENERATIVE_AI_API_KEY`, `OPENAI_API_KEY`, `NEXT_PUBLIC_SUPABASE_URL` и тд.
4. Выполните: `npm run dev` 

Для автоматического накатывания DB структур посмотрите каталог `supabase/migrations/`. Мы применяем метод прямого пула SQL (Service Role By-Pass)

</details>

## 🧩 Умный Routing & Security
Фреймворк закрыт защитным middleware слоем по паролю (`ACCESS_PASSWORD`). API интерфейсы доступны локально или в фоне для доверенных (Vercel Cron). 

<div align="center">
  <i>Developed natively on Web Ecosystem (June 2026 Version). Resilient by design.</i>
</div>