import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright config for Lumen e2e tests.
 *
 * Assumes the dev server is already running on http://localhost:3000.
 * Start it with `bun run dev` in a separate terminal before running
 * `bun run test:e2e`.
 */
export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 30_000,
  expect: { timeout: 5_000 },
  fullyParallel: false,
  retries: 0,
  workers: 1,
  reporter: "list",
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
    headless: true,
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  // We don't auto-start the dev server — start it yourself first.
  // This keeps the e2e tests fast to iterate on.
});
