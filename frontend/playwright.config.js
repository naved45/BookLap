import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir: './e2e', use: { baseURL: 'http://localhost:5173' },
  projects: [{ name: 'laptop', use: { ...devices['Desktop Chrome'], viewport: { width: 1366, height: 768 } } }, { name: 'tablet', use: devices['iPad (gen 7)'] }, { name: 'phone', use: devices['Pixel 7'] }, { name: 'small-phone', use: { ...devices['iPhone SE'] } }],
});
