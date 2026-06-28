import type { Address } from 'viem'
import { publicClient } from '../chain/client'
import { loadConfig } from '../chain/config'
import { registrarAbi } from './abi'
import { decodeWhitelist } from './roles'

// Re-export the pure role decoder + flag constants so callers can keep importing from ./reads.
export {
	decodeWhitelist,
	CLAIMANT,
	WHITELISTER,
	ADMIN,
	SUPERADMIN,
	FLAG_MASK,
	type WhitelistStatus,
} from './roles'

// Name availability under the postfix (FR-009).
export async function isNameAvailable(label: string): Promise<boolean> {
	const cfg = loadConfig()
	return publicClient().readContract({
		address: cfg.registrarAddress as Address,
		abi: registrarAbi,
		functionName: 'available',
		args: [label],
	})
}

// Whitelist status for an address: the recovered signer (claim flow) or the connected admin wallet.
export async function readWhitelist(account: Address): Promise<ReturnType<typeof decodeWhitelist>> {
	const cfg = loadConfig()
	const sentinel = await publicClient().readContract({
		address: cfg.registrarAddress as Address,
		abi: registrarAbi,
		functionName: 'whitelist',
		args: [account],
	})
	return decodeWhitelist(sentinel)
}
