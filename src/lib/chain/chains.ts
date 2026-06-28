import { env } from '$env/dynamic/public'

// One target deployment. Multiple chains let the UI switch which registrar/chain it talks to.
export interface ChainConfig {
	chainId: number
	label: string
	rpcUrl: string
	registrarAddress: string
	registrarName: string
	registrarVersion: string
	postfix: string
	explorerUrl?: string
	gasPolicyId?: string
}

// Ethereum Sepolia — the default target (real ENS is on L1; Sepolia is its testnet).
export const DEFAULT_CHAIN_ID = 11155111

const KNOWN_LABELS: Record<number, string> = {
	1: 'Ethereum',
	11155111: 'Ethereum Sepolia',
	8453: 'Base',
	84532: 'Base Sepolia',
	10: 'OP Mainnet',
	11155420: 'OP Sepolia',
	42161: 'Arbitrum',
	421614: 'Arbitrum Sepolia',
	137: 'Polygon',
	80002: 'Polygon Amoy',
	31337: 'Local (Anvil)',
}

function labelFor(chainId: number): string {
	return KNOWN_LABELS[chainId] ?? `Chain ${chainId}`
}

// The Alchemy app API key is shared across chains (the Gas Manager policy is per-chain).
export function alchemyApiKey(): string | undefined {
	return env.PUBLIC_ALCHEMY_API_KEY || undefined
}

// Legacy single-chain config from the flat PUBLIC_* keys (kept so dev/CI/test envs that set those
// keep working without a PUBLIC_CHAINS array). Returns null if the flat keys aren't all present.
const FLAT_KEYS = [
	'PUBLIC_CHAIN_ID',
	'PUBLIC_RPC_URL',
	'PUBLIC_REGISTRAR_ADDRESS',
	'PUBLIC_POSTFIX',
	'PUBLIC_REGISTRAR_NAME',
	'PUBLIC_REGISTRAR_VERSION',
] as const

function legacyChain(): ChainConfig | null {
	if (FLAT_KEYS.some((key) => !env[key])) return null
	const chainId = Number(env.PUBLIC_CHAIN_ID)
	return {
		chainId,
		label: env.PUBLIC_CHAIN_LABEL || labelFor(chainId),
		rpcUrl: env.PUBLIC_RPC_URL!,
		registrarAddress: env.PUBLIC_REGISTRAR_ADDRESS!,
		registrarName: env.PUBLIC_REGISTRAR_NAME!,
		registrarVersion: env.PUBLIC_REGISTRAR_VERSION!,
		postfix: env.PUBLIC_POSTFIX!,
		explorerUrl: env.PUBLIC_EXPLORER_URL || undefined,
		gasPolicyId: env.PUBLIC_GAS_POLICY_ID || undefined,
	}
}

// The configured target chains: a `PUBLIC_CHAINS` JSON array if set, else the legacy single chain.
export function listChains(): ChainConfig[] {
	const raw = env.PUBLIC_CHAINS
	if (raw) {
		const parsed = JSON.parse(raw) as ChainConfig[]
		return parsed.map((chain) => ({ ...chain, label: chain.label || labelFor(chain.chainId) }))
	}
	const legacy = legacyChain()
	return legacy ? [legacy] : []
}

export function chainConfig(chainId: number): ChainConfig {
	const chain = listChains().find(({ chainId: id }) => id === chainId)
	if (!chain) throw new Error(`No configured chain for id ${chainId}`)
	return chain
}

// Pure pick: the preferred chain if it's configured, else Sepolia if present, else the first
// configured chain (else Sepolia as a last resort). Exposed for unit testing.
export function pickDefaultChainId(chainIds: number[], preferred?: number): number {
	if (preferred && chainIds.includes(preferred)) return preferred
	if (chainIds.includes(DEFAULT_CHAIN_ID)) return DEFAULT_CHAIN_ID
	return chainIds[0] ?? DEFAULT_CHAIN_ID
}

// The chain selected by default: PUBLIC_DEFAULT_CHAIN_ID if configured, else Sepolia, else first.
export function defaultChainId(): number {
	const ids = listChains().map(({ chainId }) => chainId)
	return pickDefaultChainId(ids, Number(env.PUBLIC_DEFAULT_CHAIN_ID) || undefined)
}
