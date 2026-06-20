// Generate a valid one-time claim link: a fresh 32-byte secp256k1 key, base64url-encoded into the
// URL fragment. Prints the address to whitelist (allow()) and the link to open.
//
// Usage:
//   node scripts/make-claim-link.mjs                 # random key
//   node scripts/make-claim-link.mjs 0x<privateKey>  # use a specific key
//   BASE_URL=http://localhost:4173 node scripts/make-claim-link.mjs
import { hexToBytes } from 'viem'
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts'

const baseUrl = process.env.BASE_URL ?? 'http://localhost:4173'
const privateKey = process.argv[2] ?? generatePrivateKey()
const account = privateKeyToAccount(privateKey)

function toBase64Url(bytes) {
	let binary = ''
	for (const byte of bytes) binary += String.fromCharCode(byte)
	return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

console.log('private key (in the link, keep private):', privateKey)
console.log('address to whitelist (allow):          ', account.address)
console.log('claim link:                            ', `${baseUrl}/#k=${toBase64Url(hexToBytes(privateKey))}`)
