import { defineConfig } from '@playwright/test';

export default defineConfig({
	webServer: { command: 'pnpm run build && pnpm exec vite preview --port 6666', port: 6666 },
	use: {
		baseURL: 'http://localhost:6666',
		// 6666 is on Chromium's restricted-port list; allow it explicitly.
		launchOptions: { args: ['--explicitly-allowed-ports=6666'] }
	},
	testMatch: '**/*.e2e.{ts,js}'
});
