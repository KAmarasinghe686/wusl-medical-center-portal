import { defineConfig, devices } from '@playwright/test'

const externalBaseUrl = process.env.PLAYWRIGHT_BASE_URL

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,
  reporter: 'list',
  use: {
    baseURL: externalBaseUrl || 'http://127.0.0.1:3200',
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: externalBaseUrl ? undefined : {
    command: 'npm run dev -- --hostname 127.0.0.1 --port 3200',
    url: 'http://127.0.0.1:3200/login',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
})
