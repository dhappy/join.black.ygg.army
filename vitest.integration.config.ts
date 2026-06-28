import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

// Integration tests run against a local Anvil node with a freshly deployed MockRegistrar
// (see tests/integration/globalSetup.ts). Kept separate from the unit projects in vite.config.ts.
export default defineConfig({
	resolve: {
		// Mirror SvelteKit's $lib alias so specs import app code as $lib/... (not ../../src/lib/...).
		alias: { $lib: fileURLToPath(new URL('./src/lib', import.meta.url)) }
	},
	test: {
		globalSetup: ['./tests/integration/globalSetup.ts'],
		include: ['tests/integration/**/*.spec.ts'],
		testTimeout: 30000,
		hookTimeout: 60000
	}
})
