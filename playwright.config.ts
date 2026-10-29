import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './apps/mobile/e2e',
  timeout: 180000,
  expect: { timeout: 15000 },
  fullyParallel: false,
  workers: 1,
  use: {
    baseURL: 'http://127.0.0.1:8081',
    channel: 'chrome',
    permissions: ['geolocation'],
    geolocation: { latitude: 47.1123, longitude: -122.2372 },
    trace: 'off',
  },
  projects: [
    { name: '393x852', use: { viewport: { width: 393, height: 852 } } },
    { name: '375x667', use: { viewport: { width: 375, height: 667 } } },
  ],
});
