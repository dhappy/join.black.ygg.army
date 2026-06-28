// Pure whitelist role/permission decoding — no chain or $env imports, so it's usable from plain
// (non-SvelteKit) test runners as well as the app.

// Role flags packed into the low byte of a whitelist entry (must match the registrar).
export const CLAIMANT = 1n
export const WHITELISTER = 2n
export const ADMIN = 4n
export const SUPERADMIN = 8n
// First value past the reserved flag byte: role flags are < FLAG_MASK, block heights are >=.
export const FLAG_MASK = 2n ** 8n

export interface WhitelistStatus {
	// Roles the address currently holds (false once a claimant has redeemed).
	isClaimant: boolean
	isWhitelister: boolean
	isAdmin: boolean
	isSuperadmin: boolean
	// Claim-flow view: `authorized` = was/is a claimant; `used` = already redeemed.
	authorized: boolean
	used: boolean
	// Block the claimant redeemed at (only when used); a free audit trail.
	usedAtBlock?: bigint
}

// Decode the packed whitelist sentinel (see abi.ts). Values < FLAG_MASK are a role bitfield; a
// sentinel >= FLAG_MASK is a redeemed claimant whose value is the block height. Pure, unit-tested.
export function decodeWhitelist(sentinel: bigint): WhitelistStatus {
	const used = sentinel >= FLAG_MASK
	const flags = used ? 0n : sentinel
	const isClaimant = (flags & CLAIMANT) !== 0n
	return {
		isClaimant,
		isWhitelister: (flags & WHITELISTER) !== 0n,
		isAdmin: (flags & ADMIN) !== 0n,
		isSuperadmin: (flags & SUPERADMIN) !== 0n,
		// A redeemed entry no longer carries the CLAIMANT bit, but was a claimant — so `authorized`
		// stays true and `used` true → the claim flow reports AlreadyRedeemed, not NotAuthorized.
		authorized: isClaimant || used,
		used,
		usedAtBlock: used ? sentinel : undefined,
	}
}
