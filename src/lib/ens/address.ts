import { getAddress, isAddress } from 'viem'
import type { Address } from 'viem'

// Validate the target address the claimed name will resolve to (FR-003). Checksum-tolerant on
// input (accepts all-lowercase) and returns the checksummed form.
export type ValidatedAddress =
	| { ok: true, address: Address }
	| { ok: false }

export function validateAddress(input: string): ValidatedAddress {
	const trimmed = input.trim()
	if (!isAddress(trimmed, { strict: false })) return { ok: false }
	try {
		return { ok: true, address: getAddress(trimmed) }
	} catch {
		return { ok: false }
	}
}
