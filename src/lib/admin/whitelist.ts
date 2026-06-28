import type { Address, Hex, WalletClient } from 'viem'
import { appChain, publicClient } from '$lib/chain/client'
import { loadConfig } from '$lib/chain/config'
import { registrarAbi } from '$lib/registrar/abi'
import type { WhitelistAction } from './actions'

export interface ActionResult {
	txHash: Hex
}

// Execute a role grant/revoke against the registrar via the connected wallet, then wait for it to be
// mined. The caller pays gas (admin action, not a sponsored claim). The contract enforces that
// `account` holds the role required by `action`; the UI gates on it too for a better message.
export async function runAction(
	client: WalletClient,
	account: Address,
	action: WhitelistAction,
	accounts: Address[],
): Promise<ActionResult> {
	if (accounts.length === 0) throw new Error('EmptyList')
	const cfg = loadConfig()
	const common = {
		account,
		chain: appChain(),
		address: cfg.registrarAddress as Address,
		abi: registrarAbi,
	} as const

	const txHash =
		action.functionName === 'deny'
			? await client.writeContract({ ...common, functionName: 'deny', args: [accounts, action.flag] })
			: await client.writeContract({ ...common, functionName: action.functionName, args: [accounts] })

	await publicClient().waitForTransactionReceipt({ hash: txHash })
	return { txHash }
}
