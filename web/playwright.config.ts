import { defineConfig, devices } from '@playwright/test';

// AGENTS.md: all projects run on Chromium (desktop + mobile emulation).
// The iPhone descriptor defaults to WebKit, so strip defaultBrowserType.
const { defaultBrowserType: _iphoneDefault, ...iphone14 } = devices['iPhone 14'];
void _iphoneDefault;

export default defineConfig({
  testDir: './e2e',
  timeout: 120_000,
  retries: 1,
  use: { baseURL: 'http://127.0.0.1:4173' },
  webServer: {
    command: 'npm run preview -- --port 4173 --strictPort',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: !process.env['CI'],
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'iphone-14', use: { ...iphone14 } },
    { name: 'pixel-7', use: { ...devices['Pixel 7'] } },
  ],
});
