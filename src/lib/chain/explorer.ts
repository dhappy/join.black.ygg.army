// Block-explorer (Etherscan-family) base URLs by chain id. Extend as needed.
const EXPLORERS: Record<number, string> = {
	1: 'https://etherscan.io',
	11155111: 'https://sepolia.etherscan.io',
	8453: 'https://basescan.org',
	84532: 'https://sepolia.basescan.org',
	10: 'https://optimistic.etherscan.io',
	11155420: 'https://sepolia-optimism.etherscan.io',
	42161: 'https://arbiscan.io',
	421614: 'https://sepolia.arbiscan.io',
	137: 'https://polygonscan.com',
	80002: 'https://amoy.polygonscan.com',
}

// The explorer base for `chainId`, or null when unknown. An explicit `override` (PUBLIC explorerUrl)
// takes precedence over the built-in map.
function explorerBase(chainId: number, override?: string): string | null {
	return (override || EXPLORERS[chainId])?.replace(/\/+$/, '') ?? null
}

export function explorerTxUrl(chainId: number, txHash: string, override?: string): string | null {
	const base = explorerBase(chainId, override)
	return base ? `${base}/tx/${txHash}` : null
}

export function explorerAddressUrl(chainId: number, address: string, override?: string): string | null {
	const base = explorerBase(chainId, override)
	return base ? `${base}/address/${address}` : null
}
