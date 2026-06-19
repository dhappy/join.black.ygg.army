import { privateKeyToAccount } from 'viem/accounts'
import type { Address, Hex } from 'viem'

// Parses the one-time claim link per contracts/claim-link.md: the 32-byte secp256k1 key is
// base64url-encoded in the URL fragment as `#k=<base64url>` and decoded entirely client-side.
export type ParsedClaimLink =
	| { ok: true, privateKey: Hex, signerAddress: Address }
	| { ok: false, reason: 'missing' | 'malformed' }

export function toBase64Url(bytes: Uint8Array): string {
	let binary = ''
	for (const byte of bytes) binary += String.fromCharCode(byte)
	return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export function fromBase64Url(value: string): Uint8Array {
	const base64 = value.replace(/-/g, '+').replace(/_/g, '/')
	const padding = base64.length % 4 === 0 ? '' : '='.repeat(4 - (base64.length % 4))
	const binary = atob(base64 + padding)
	const bytes = new Uint8Array(binary.length)
	for (let index = 0; index < binary.length; index++) bytes[index] = binary.charCodeAt(index)
	return bytes
}

export function extractKeyParam(hash: string): string | null {
	const raw = hash.startsWith('#') ? hash.slice(1) : hash
	return new URLSearchParams(raw).get('k')
}

// Return the href with its fragment removed, so the key can be cleared from the address bar /
// history without navigating (FR-010, contracts/claim-link.md).
export function stripFragment(href: string): string {
	const index = href.indexOf('#')
	return index === -1 ? href : href.slice(0, index)
}

export function parseClaimLink(hash: string): ParsedClaimLink {
	const encoded = extractKeyParam(hash)
	if (!encoded) return { ok: false, reason: 'missing' }

	let bytes: Uint8Array
	try {
		bytes = fromBase64Url(encoded)
	} catch {
		return { ok: false, reason: 'malformed' }
	}
	if (bytes.length !== 32) return { ok: false, reason: 'malformed' }

	const privateKey = `0x${Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')}` as Hex
	try {
		const account = privateKeyToAccount(privateKey)
		return { ok: true, privateKey, signerAddress: account.address }
	} catch {
		return { ok: false, reason: 'malformed' }
	}
}
