import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './apps/mobile/e2e',
  timeout: 240000,
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
    { name: '375x667', use: { viewport: { width: 375, height: 667 } } },
    { name: '390x844', use: { viewport: { width: 390, height: 844 } } },
    { name: '393x852', use: { viewport: { width: 393, height: 852 } } },
    { name: '430x932', use: { viewport: { width: 430, height: 932 } } },
    { name: '667x375', use: { viewport: { width: 667, height: 375 } } },
  ],
});
