import { describe, expect, it } from 'vitest'
import { explorerTxUrl } from './explorer'

const TX = '0xabc'

describe('explorerTxUrl', () => {
	it('builds a Base Sepolia link', () => {
		expect(explorerTxUrl(84532, TX)).toBe('https://sepolia.basescan.org/tx/0xabc')
	})

	it('builds an Ethereum mainnet link', () => {
		expect(explorerTxUrl(1, TX)).toBe('https://etherscan.io/tx/0xabc')
	})

	it('prefers an explicit override and trims a trailing slash', () => {
		expect(explorerTxUrl(84532, TX, 'https://custom.scan/')).toBe('https://custom.scan/tx/0xabc')
	})

	it('returns null for an unknown chain with no override', () => {
		expect(explorerTxUrl(999999, TX)).toBeNull()
	})
})
