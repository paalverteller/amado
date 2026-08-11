import { defineConfig, devices } from '@playwright/test'

/**
 * NOT run or verified in the environment this was written in -- no live
 * Next dev server, Supabase project, or AI provider keys were available
 * there. Written against the real selectors/text used by the actual
 * pages (checked against the source, not guessed), but "written
 * correctly" and "passes against a live stack" are different claims;
 * only the first one is made here. Run for real with:
 *
 *   ACCESS_PASSWORD=... npm run dev &
 *   npx playwright install chromium
 *   npm run test:e2e
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false, // the core-journey test is one long dependent flow
  retries: 1,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:3000',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
})
