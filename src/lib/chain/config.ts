import { activeChainId } from './active.svelte'
import { alchemyApiKey, chainConfig, type ChainConfig } from './chains'

// The resolved config for the chain the UI is currently targeting, plus the shared Alchemy key.
// Re-resolves on every call, so a chain switch in the UI immediately changes what reads/writes hit.
export interface AppConfig extends ChainConfig {
	alchemyApiKey?: string
}

export function loadConfig(): AppConfig {
	const chain = chainConfig(activeChainId())
	return { ...chain, alchemyApiKey: alchemyApiKey() }
}
