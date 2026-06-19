import { defineConfig } from '@playwright/test';

export default defineConfig({
	webServer: { command: 'node scripts/e2e-server.mjs', port: 6666, timeout: 120_000 },
	use: {
		baseURL: 'http://localhost:6666',
		// 6666 is on Chromium's restricted-port list; allow it explicitly.
		launchOptions: { args: ['--explicitly-allowed-ports=6666'] }
	},
	testMatch: '**/*.e2e.{ts,js}'
});
