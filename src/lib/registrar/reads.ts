import type { Address } from 'viem'
import { publicClient } from '../chain/client'
import { loadConfig } from '../chain/config'
import { registrarAbi } from './abi'

// Name availability under the postfix (FR-009).
export async function isNameAvailable(label: string): Promise<boolean> {
	const cfg = loadConfig()
	return publicClient().readContract({
		address: cfg.registrarAddress as Address,
		abi: registrarAbi,
		functionName: 'available',
		args: [label]
	})
}

// Whitelist status for a recovered signer (FR-006): authorized + already-used flags.
export async function readWhitelist(account: Address): Promise<{ authorized: boolean, used: boolean }> {
	const cfg = loadConfig()
	const [authorized, used] = await publicClient().readContract({
		address: cfg.registrarAddress as Address,
		abi: registrarAbi,
		functionName: 'whitelist',
		args: [account]
	})
	return { authorized, used }
}
