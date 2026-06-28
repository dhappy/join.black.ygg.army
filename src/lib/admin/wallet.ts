import { createWalletClient, custom, getAddress, numberToHex } from 'viem'
import type { Address, WalletClient } from 'viem'
import { appChain } from '../chain/client'
import { loadConfig } from '../chain/config'

export interface Connection {
	client: WalletClient
	account: Address
	chainId: number
}

// Connect the injected browser wallet (EIP-1193) for owner-only admin actions. The high-value
// owner key never enters the page — it stays in the extension. Prompts for accounts, then ensures
// the wallet is on the configured chain (switching, or adding it, if needed).
export async function connectWallet(): Promise<Connection> {
	const provider = window.ethereum
	if (!provider) throw new Error('NoWallet')

	const cfg = loadConfig()
	const chain = appChain()

	const accounts = (await provider.request({ method: 'eth_requestAccounts' })) as Address[]
	const account = accounts[0]
	if (!account) throw new Error('NoAccount')

	await ensureChain(provider, cfg.chainId, cfg.rpcUrl)

	const client = createWalletClient({ account, chain, transport: custom(provider) })
	return { client, account: getAddress(account), chainId: cfg.chainId }
}

// Ask the wallet to switch to the target chain; if it isn't known to the wallet, add it first.
async function ensureChain(
	provider: NonNullable<Window['ethereum']>,
	chainId: number,
	rpcUrl: string
) {
	const hexId = numberToHex(chainId)
	try {
		await provider.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: hexId }] })
	} catch (error) {
		// 4902 = chain unknown to the wallet; offer to add it, then it's selected automatically.
		if (isChainNotAdded(error)) {
			await provider.request({
				method: 'wallet_addEthereumChain',
				params: [
					{
						chainId: hexId,
						chainName: `chain-${chainId}`,
						nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
						rpcUrls: [rpcUrl]
					}
				]
			})
			return
		}
		throw error
	}
}

function isChainNotAdded(error: unknown): boolean {
	return typeof error === 'object' && error !== null && 'code' in error && error.code === 4902
}
