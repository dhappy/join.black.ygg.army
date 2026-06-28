import { getAddress, isAddress } from 'viem'
import type { Address } from 'viem'

// One rejected input line, kept with its 1-based line number so the UI can point at it.
export interface InvalidEntry {
	line: number
	raw: string
}

export interface ParsedAddressList {
	// Checksummed, de-duplicated addresses, in first-seen order.
	valid: Address[]
	// Lines that aren't valid addresses (blank lines are ignored, not reported).
	invalid: InvalidEntry[]
	// Count of valid addresses dropped because an earlier line already had them.
	duplicates: number
}

// Parse a free-form blob (paste of one address per line, or comma/space/semicolon separated)
// into a clean, de-duplicated, checksummed list, surfacing invalid lines for the user to fix.
export function parseAddressList(input: string): ParsedAddressList {
	const valid: Address[] = []
	const invalid: InvalidEntry[] = []
	const seen = new Set<string>()
	let duplicates = 0

	const lines = input.split('\n')
	for (let i = 0; i < lines.length; i++) {
		// Allow several addresses on one line (comma / semicolon / whitespace separated).
		const tokens = lines[i].split(/[\s,;]+/).filter((token) => token.length > 0)
		for (const token of tokens) {
			if (!isAddress(token, { strict: false })) {
				invalid.push({ line: i + 1, raw: token })
				continue
			}
			const address = getAddress(token)
			const key = address.toLowerCase()
			if (seen.has(key)) {
				duplicates++
				continue
			}
			seen.add(key)
			valid.push(address)
		}
	}

	return { valid, invalid, duplicates }
}
