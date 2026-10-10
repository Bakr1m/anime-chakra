import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'iphone-14', use: { ...devices['iPhone 14'] } },
    { name: 'pixel-7', use: { ...devices['Pixel 7'] } },
  ],
});
