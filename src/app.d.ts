// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
import type { EIP1193Provider } from 'viem'

declare global {
	namespace App {
		// interface Error {}
		// interface Locals {}
		// interface PageData {}
		// interface PageState {}
		// interface Platform {}
	}

	// Injected wallet (MetaMask, Rabby, …) used by the owner-only whitelist admin UI.
	interface Window {
		ethereum?: EIP1193Provider
	}
}

export {}
