import { describe, expect, it } from 'vitest'
import { ADMIN, CLAIMANT, decodeWhitelist, SUPERADMIN, WHITELISTER } from '$lib/registrar/roles'
import { canPerform, requiredRole, WHITELIST_ACTIONS } from './actions'

const find = (id: string) => WHITELIST_ACTIONS.find((a) => a.id === id)!

describe('requiredRole', () => {
	it('maps each managed flag to the role that may manage it', () => {
		expect(requiredRole(CLAIMANT)).toBe(WHITELISTER)
		expect(requiredRole(WHITELISTER)).toBe(ADMIN)
		expect(requiredRole(ADMIN)).toBe(SUPERADMIN)
		expect(requiredRole(SUPERADMIN)).toBe(SUPERADMIN)
	})
})

describe('canPerform', () => {
	const whitelister = decodeWhitelist(WHITELISTER)
	const admin = decodeWhitelist(ADMIN | WHITELISTER)
	const superadmin = decodeWhitelist(SUPERADMIN | ADMIN | WHITELISTER)

	it('lets a whitelister grant/revoke claimants but nothing higher', () => {
		expect(canPerform(whitelister, find('grant-claimant'))).toBe(true)
		expect(canPerform(whitelister, find('revoke-claimant'))).toBe(true)
		expect(canPerform(whitelister, find('grant-whitelister'))).toBe(false)
		expect(canPerform(whitelister, find('grant-admin'))).toBe(false)
	})

	it('lets an admin also manage whitelisters', () => {
		expect(canPerform(admin, find('grant-claimant'))).toBe(true)
		expect(canPerform(admin, find('grant-whitelister'))).toBe(true)
		expect(canPerform(admin, find('grant-admin'))).toBe(false)
	})

	it('lets a superadmin do everything', () => {
		for (const action of WHITELIST_ACTIONS) {
			expect(canPerform(superadmin, action)).toBe(true)
		}
	})

	it('denies a spent claimant and a null status', () => {
		const used = decodeWhitelist(2n ** 8n + 5n)
		expect(canPerform(used, find('grant-claimant'))).toBe(false)
		expect(canPerform(null, find('grant-claimant'))).toBe(false)
	})
})
