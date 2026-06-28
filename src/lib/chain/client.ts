import { createPublicClient, defineChain, http } from 'viem'
import {
	arbitrum,
	arbitrumSepolia,
	base,
	baseSepolia,
	mainnet,
	optimism,
	optimismSepolia,
	polygon,
	polygonAmoy,
	sepolia,
} from '@account-kit/infra'
import { loadConfig } from './config'

// Build the target chain from public config so the app stays chain-agnostic (research.md §5).
export function appChain() {
	const cfg = loadConfig()
	return defineChain({
		id: cfg.chainId,
		name: `chain-${cfg.chainId}`,
		nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
		rpcUrls: { default: { http: [cfg.rpcUrl] } },
	})
}

export function publicClient() {
	return createPublicClient({ chain: appChain(), transport: http() })
}

// Account Kit chain objects carry the Alchemy bundler/gas-manager metadata the AA client needs, so
// the gasless path resolves the configured chainId to one of these rather than a plain defineChain.
const ALCHEMY_CHAINS = [
	mainnet,
	sepolia,
	base,
	baseSepolia,
	arbitrum,
	arbitrumSepolia,
	optimism,
	optimismSepolia,
	polygon,
	polygonAmoy,
]

export function alchemyChain(chainId: number) {
	const chain = ALCHEMY_CHAINS.find((candidate) => candidate.id === chainId)
	if (!chain) throw new Error(`UnsupportedChain:${chainId}`)
	return chain
}
