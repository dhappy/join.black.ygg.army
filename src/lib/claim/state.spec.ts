import { describe, expect, it } from 'vitest'
import { getAddress } from 'viem'
import { stateForLink, stateForWhitelist } from './state'

const SIGNER = getAddress('0x70997970c51812dc3a010c7d01b50e0d17dc79c8')

describe('stateForLink', () => {
	it('maps a missing key to MissingKey', () => {
		expect(stateForLink({ ok: false, reason: 'missing' })).toEqual({ kind: 'MissingKey' })
	})

	it('maps a malformed key to InvalidLink', () => {
		expect(stateForLink({ ok: false, reason: 'malformed' })).toEqual({ kind: 'InvalidLink' })
	})

	it('maps a valid link to CheckingWhitelist', () => {
		const parsed = { ok: true, privateKey: '0x00' as const, signerAddress: SIGNER } as const
		expect(stateForLink(parsed)).toEqual({ kind: 'CheckingWhitelist', signer: SIGNER })
	})
})

describe('stateForWhitelist', () => {
	it('returns NotAuthorized when not whitelisted', () => {
		expect(stateForWhitelist(SIGNER, { authorized: false, used: false })).toEqual({
			kind: 'NotAuthorized',
			signer: SIGNER
		})
	})

	it('returns AlreadyRedeemed when the entry is used', () => {
		expect(stateForWhitelist(SIGNER, { authorized: true, used: true })).toEqual({
			kind: 'AlreadyRedeemed',
			signer: SIGNER
		})
	})

	it('returns Ready when authorized and unused', () => {
		expect(stateForWhitelist(SIGNER, { authorized: true, used: false })).toEqual({
			kind: 'Ready',
			signer: SIGNER
		})
	})
})
