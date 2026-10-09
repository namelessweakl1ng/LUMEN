import { defineConfig, devices } from '@playwright/test';
const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH;
export default defineConfig({
  testDir: './tests/e2e', timeout: 30_000, expect: { timeout: 8_000 },
  fullyParallel: false, retries: 0, workers: 1, reporter: 'list',
  use: { baseURL: 'http://127.0.0.1:3000', trace: 'retain-on-failure', headless: true },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'], launchOptions: executablePath ? {executablePath,args:['--no-sandbox']} : {} } }],
  webServer: [
    {command: 'uv --directory ../backend run uvicorn tests.e2e_server:app --host 127.0.0.1 --port 8000 --no-access-log --no-proxy-headers', url: 'http://127.0.0.1:8000/api/v1/health', reuseExistingServer: false, timeout:120_000},
    {command: 'bun run dev', env: {LUMEN_BACKEND_URL:'http://127.0.0.1:8000', NEXT_TELEMETRY_DISABLED:'1'}, url: 'http://127.0.0.1:3000', reuseExistingServer: false, timeout:120_000},
  ],
});
