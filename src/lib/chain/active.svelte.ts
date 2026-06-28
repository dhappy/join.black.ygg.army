import { browser } from '$app/environment'
import { defaultChainId, listChains } from './chains'

const STORAGE_KEY = 'targetChainId'

// The chain the UI is currently targeting. 0 until a selection/restore happens, at which point
// activeChainId() falls back to the configured default — so reads work during prerender too.
let selected = $state(0)

export function activeChainId(): number {
	return selected || defaultChainId()
}

// Restore a previously chosen chain from localStorage (browser only); call once on app start.
export function initActiveChain(): void {
	if (!browser) return
	const saved = Number(localStorage.getItem(STORAGE_KEY))
	if (saved && listChains().some(({ chainId }) => chainId === saved)) selected = saved
}

export function setActiveChainId(chainId: number): void {
	selected = chainId
	if (browser) localStorage.setItem(STORAGE_KEY, String(chainId))
}
