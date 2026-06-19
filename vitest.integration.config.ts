import { defineConfig } from 'vitest/config';

// Integration tests run against a local Anvil node with a freshly deployed MockRegistrar
// (see tests/integration/globalSetup.ts). Kept separate from the unit projects in vite.config.ts.
export default defineConfig({
	test: {
		globalSetup: ['./tests/integration/globalSetup.ts'],
		include: ['tests/integration/**/*.spec.ts'],
		testTimeout: 30000,
		hookTimeout: 60000
	}
});
