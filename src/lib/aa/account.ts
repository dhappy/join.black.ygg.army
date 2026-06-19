import { http } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { createBundlerClient, createPaymasterClient, entryPoint07Address } from 'viem/account-abstraction'
import { toSafeSmartAccount } from 'permissionless/accounts'
import type { Hex } from 'viem'
import { loadConfig } from '../chain/config'
import { appChain, publicClient } from '../chain/client'

// Build a counterfactual Safe smart account owned by the embedded key, wired to a bundler and an
// on-chain-scoped Paymaster so the claimant pays no gas (research.md §3-4, contracts/erc4337-integration.md).
export async function createSponsoredClient(privateKey: Hex) {
	const cfg = loadConfig()
	const client = publicClient()
	const owner = privateKeyToAccount(privateKey)

	const account = await toSafeSmartAccount({
		client,
		owners: [owner],
		version: '1.4.1',
		entryPoint: { address: entryPoint07Address, version: '0.7' }
	})

	const paymaster = createPaymasterClient({ transport: http(cfg.paymasterUrl) })
	const bundler = createBundlerClient({
		account,
		client,
		chain: appChain(),
		transport: http(cfg.bundlerUrl),
		paymaster
	})

	return { account, bundler }
}
