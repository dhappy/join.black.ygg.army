#!/usr/bin/env node

// Generate a batch of one-time claim links + QR codes for distribution.
//
// Creates a timestamp-named directory containing:
//   addresses.txt      — the n signer addresses (paste into /whitelist → bulkWhitelist)
//   links.txt          — the n claim URLs (each embeds a private key in its #fragment)
//   qr/<i>-<address>.svg — n QR codes (error-correction level Q ≈ 25%) of those links
// Line i of addresses.txt ↔ line i of links.txt ↔ the i-th QR file.
//
// Usage:
//   node scripts/make-claim-batch.mjs                 # 16 (default)
//   node scripts/make-claim-batch.mjs 50              # 50
//   BASE_URL=https://join.black.ygg.army OUT_DIR=./claims node scripts/make-claim-batch.mjs 16
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { hexToBytes } from 'viem'
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts'
import QRCode from 'qrcode'

const n = Number.parseInt(process.argv[2] ?? '16', 10)
if (!Number.isInteger(n) || n < 1) {
	console.error(`error: n must be a positive integer (got "${process.argv[2]}")`)
	process.exit(1)
}

const baseUrl = (process.env.BASE_URL ?? 'http://localhost:4173').replace(/\/+$/, '')
const outParent = process.env.OUT_DIR ?? '.'

function toBase64Url(bytes) {
	let binary = ''
	for (const byte of bytes) binary += String.fromCharCode(byte)
	return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

// invites.2026⁄06⁄28@19:38:40.567Z — '⁄' is U+2044 FRACTION SLASH (a legal filename char, unlike
// '/'); 'T'→'@' and colons are kept. Mode 700 — these files hold private keys.
const stamp = `invites.${new Date().toISOString().replace(/-/g, '⁄').replace('T', '@')}`
const dir = join(outParent, stamp)
const qrDir = join(dir, 'qr')
mkdirSync(qrDir, { recursive: true, mode: 0o700 })

const addresses = []
const links = []
const pad = String(n).length

for (let i = 0; i < n; i++) {
	const privateKey = generatePrivateKey()
	const { address } = privateKeyToAccount(privateKey)
	const link = `${baseUrl}/#k=${toBase64Url(hexToBytes(privateKey))}`
	addresses.push(address)
	links.push(link)
	const file = `${String(i + 1).padStart(pad, '0')}-${address}.svg`
	// Level Q = ~25% error correction (L 7% / M 15% / Q 25% / H 30%). SVG = scalable for print.
	await QRCode.toFile(join(qrDir, file), link, { type: 'svg', errorCorrectionLevel: 'Q', margin: 2 })
}

writeFileSync(join(dir, 'addresses.txt'), `${addresses.join('\n')}\n`)
writeFileSync(join(dir, 'links.txt'), `${links.join('\n')}\n`)

console.log(`Wrote ${n} claim set(s) to ${dir}/`)
console.log('  addresses.txt — whitelist these (paste into /whitelist → bulkWhitelist)')
console.log('  links.txt     — distribute one per claimant (each embeds its key)')
console.log(`  qr/           — ${n} QR codes (error correction Q ≈ 25%) of the links`)
console.log(`base URL: ${baseUrl}  (override with BASE_URL=…)`)
