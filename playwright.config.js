const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: '.',
  testMatch: 'smoke.spec.js',
  use: { baseURL: 'http://127.0.0.1:8000', headless: true },
  webServer: {
    command: 'python3 -m http.server 8000',
    url: 'http://127.0.0.1:8000',
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
});
