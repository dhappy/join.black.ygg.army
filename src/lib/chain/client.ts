import { createPublicClient, defineChain, http } from 'viem';
import { loadConfig } from './config';

// Build the target chain from public config so the app stays chain-agnostic (research.md §5).
export function appChain() {
	const cfg = loadConfig();
	return defineChain({
		id: cfg.chainId,
		name: `chain-${cfg.chainId}`,
		nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
		rpcUrls: { default: { http: [cfg.rpcUrl] } }
	});
}

export function publicClient() {
	return createPublicClient({ chain: appChain(), transport: http() });
}
