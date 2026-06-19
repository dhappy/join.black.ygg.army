import { describe, expect, it } from 'vitest'
import { getAddress } from 'viem'
import { validateAddress } from './address'

const LOWER = '0xd8da6bf26964af9d7eed9e03e53415d37aa96045'

describe('validateAddress', () => {
	it('accepts a lowercase address and returns it checksummed', () => {
		expect(validateAddress(LOWER)).toEqual({ ok: true, address: getAddress(LOWER) })
	})

	it('accepts a correctly checksummed address', () => {
		const checksummed = getAddress(LOWER)
		expect(validateAddress(checksummed)).toEqual({ ok: true, address: checksummed })
	})

	it('trims surrounding whitespace', () => {
		expect(validateAddress(`  ${LOWER}  `)).toEqual({ ok: true, address: getAddress(LOWER) })
	})

	it('rejects a non-address string', () => {
		expect(validateAddress('not-an-address')).toEqual({ ok: false })
	})

	it('rejects a too-short hex string', () => {
		expect(validateAddress('0x1234')).toEqual({ ok: false })
	})

	it('rejects an empty string', () => {
		expect(validateAddress('')).toEqual({ ok: false })
	})
})
