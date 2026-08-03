# 1) сохраните скрипт выше как apply_sprint1_ru_shell.py в корне репозитория

# 2) сухой прогон — ничего не меняет, только план
python3 apply_sprint1_ru_shell.py --check

# 3) применить
python3 apply_sprint1_ru_shell.py

# 4) проверка (сообщите мне вывод, если что-то упадёт — поправлю скрипт)
npm install
npx tsc --noEmit
npm run lint
npm run test
npm run build

# 5) коммит и пуш
git add -A
git commit -m "feat(sprint-1): Russian workspace shell — nav, i18n, overview/knowledge/competitors shells

- lib/i18n/config.ts: full Russian dictionary, ru is now the default UI locale
  (pt-BR kept as generated-content language + fallback)
- components/Layout.tsx: nav restructured to target IA (Обзор/Рынок/Генерация/
  База знаний/Бренд/Конкуренты + utility row), nothing deleted
- new route shells: /overview (real freshness data from /api/market),
  /knowledge, /competitors
- proxy.ts + logo now point post-login/home to /overview
- vitest + Russian-parity regression test (lib/i18n/config.test.ts)
- docs/SCHEMA.md: audited actual schema (46 tables) vs lean-plan target
- docs/AMADO_ROADMAP.md: sprint tracker for the rest of the lean plan"
git push