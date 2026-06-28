import { describe, expect, it } from 'vitest'
import { ADMIN, CLAIMANT, decodeWhitelist, FLAG_MASK, SUPERADMIN, WHITELISTER } from './roles'

describe('decodeWhitelist', () => {
	it('treats 0 as no permissions', () => {
		const s = decodeWhitelist(0n)
		expect(s).toMatchObject({
			isClaimant: false,
			isWhitelister: false,
			isAdmin: false,
			isSuperadmin: false,
			authorized: false,
			used: false,
		})
		expect(s.usedAtBlock).toBeUndefined()
	})

	it('decodes an unused claimant', () => {
		const s = decodeWhitelist(CLAIMANT)
		expect(s.isClaimant).toBe(true)
		expect(s.authorized).toBe(true)
		expect(s.used).toBe(false)
	})

	it('decodes a whitelister that is not a claimant', () => {
		const s = decodeWhitelist(WHITELISTER)
		expect(s.isWhitelister).toBe(true)
		expect(s.isClaimant).toBe(false)
		expect(s.authorized).toBe(false) // not claimable
	})

	it('decodes cumulative admin and superadmin role bundles', () => {
		const admin = decodeWhitelist(ADMIN | WHITELISTER)
		expect(admin).toMatchObject({ isAdmin: true, isWhitelister: true, isSuperadmin: false })

		const superadmin = decodeWhitelist(SUPERADMIN | ADMIN | WHITELISTER)
		expect(superadmin).toMatchObject({ isSuperadmin: true, isAdmin: true, isWhitelister: true })
	})

	it('treats a value >= FLAG_MASK as a redeemed claimant carrying the redeem block', () => {
		const block = FLAG_MASK + 12345n
		const s = decodeWhitelist(block)
		expect(s.used).toBe(true)
		expect(s.authorized).toBe(true) // was a claimant → AlreadyRedeemed, not NotAuthorized
		expect(s.isClaimant).toBe(false) // the flag bits no longer apply
		expect(s.usedAtBlock).toBe(block)
	})
})
