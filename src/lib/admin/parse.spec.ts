import { describe, expect, it } from 'vitest'
import { getAddress } from 'viem'
import { parseAddressList } from './parse'

const A = '0xd8da6bf26964af9d7eed9e03e53415d37aa96045'
const B = '0x70997970c51812dc3a010c7d01b50e0d17dc79c8'

describe('parseAddressList', () => {
	it('parses one address per line and checksums them', () => {
		const result = parseAddressList(`${A}\n${B}`)
		expect(result.valid).toEqual([getAddress(A), getAddress(B)])
		expect(result.invalid).toEqual([])
		expect(result.duplicates).toBe(0)
	})

	it('ignores blank lines and surrounding whitespace', () => {
		const result = parseAddressList(`\n  ${A}  \n\n`)
		expect(result.valid).toEqual([getAddress(A)])
		expect(result.invalid).toEqual([])
	})

	it('splits comma / semicolon / space separated addresses on one line', () => {
		const result = parseAddressList(`${A}, ${B}; ${A}`)
		expect(result.valid).toEqual([getAddress(A), getAddress(B)])
		expect(result.duplicates).toBe(1)
	})

	it('de-duplicates case-insensitively, keeping first-seen order', () => {
		const result = parseAddressList(`${getAddress(A)}\n${A.toUpperCase().replace('0X', '0x')}`)
		expect(result.valid).toEqual([getAddress(A)])
		expect(result.duplicates).toBe(1)
	})

	it('reports invalid lines with their 1-based line number', () => {
		const result = parseAddressList(`${A}\nnope\n0x1234`)
		expect(result.valid).toEqual([getAddress(A)])
		expect(result.invalid).toEqual([
			{ line: 2, raw: 'nope' },
			{ line: 3, raw: '0x1234' }
		])
	})

	it('returns empty results for empty input', () => {
		expect(parseAddressList('')).toEqual({ valid: [], invalid: [], duplicates: 0 })
	})
})
