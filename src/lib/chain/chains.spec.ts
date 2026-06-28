import { describe, expect, it } from 'vitest'
import { DEFAULT_CHAIN_ID, pickDefaultChainId } from './chains'

describe('pickDefaultChainId', () => {
	it('prefers the requested chain when it is configured', () => {
		expect(pickDefaultChainId([1, 11155111, 8453], 8453)).toBe(8453)
	})

	it('falls back to Sepolia when the preferred chain is absent', () => {
		expect(pickDefaultChainId([1, 11155111], 999)).toBe(DEFAULT_CHAIN_ID)
		expect(pickDefaultChainId([1, 11155111])).toBe(DEFAULT_CHAIN_ID)
	})

	it('falls back to the first configured chain when Sepolia is absent', () => {
		expect(pickDefaultChainId([1, 8453])).toBe(1)
	})

	it('returns Sepolia as a last resort when nothing is configured', () => {
		expect(pickDefaultChainId([])).toBe(DEFAULT_CHAIN_ID)
	})
})
