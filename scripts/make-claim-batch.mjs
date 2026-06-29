#!/usr/bin/env node

// Generate a batch of one-time claim links + QR codes for distribution.
//
// Creates a timestamp-named directory `invites.YYYY⁄MM⁄DD@HH:MM:SS.mmmZ/` containing:
//   addresses.txt      — the n signer addresses (paste into /whitelist → bulkWhitelist)
//   links.txt          — the n claim URLs (each embeds a private key in its #fragment)
//   qr/<i>-<address>.svg — n QR codes (error-correction level Q ≈ 25%) of those links
// Line i of addresses.txt ↔ line i of links.txt ↔ the i-th QR file.
//
// Usage:
//   node scripts/make-claim-batch.mjs                              # 16, base http://localhost:4173
//   node scripts/make-claim-batch.mjs -n 50                        # 50
//   node scripts/make-claim-batch.mjs --count 50 --base join.black.ygg.army   # https:// added
//   OUT_DIR=./claims node scripts/make-claim-batch.mjs --base https://join.black.ygg.army
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { hexToBytes } from 'viem'
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts'
import QRCode from 'qrcode'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

const argv = yargs(hideBin(process.argv))
	.scriptName('make-claim-batch')
	.option('count', {
		alias: 'n',
		type: 'number',
		default: 16,
		describe: 'how many claim sets to generate',
	})
	.option('base', {
		alias: 'b',
		type: 'string',
		default: process.env.BASE_URL ?? 'http://localhost:4173',
		describe: 'base URL the links point at (a bare hostname gets https:// added)',
	})
	.strict()
	.parseSync()

const n = argv.count
if (!Number.isInteger(n) || n < 1) {
	console.error(`error: --count must be a positive integer (got "${argv.count}")`)
	process.exit(1)
}

// A bare hostname (no scheme) gets https://; trailing slashes trimmed.
const baseUrl = (argv.base.includes('://') ? argv.base : `https://${argv.base}`).replace(/\/+$/, '')
const outParent = process.env.OUT_DIR ?? '.'

// Printable sheet: 8.5⨯11in of eight 4⨯2.5in labels (2 cols ⨯ 4 rows). All in inches.
//   width  = 0.2 left + 4 + 0.1 center + 4 + 0.2 right             = 8.5
//   height = 0.5 top  + 4 rows ⨯ 2.5 (rows abut, no gutter) + 0.5  = 11
// Each label holds two 2in-square QR codes side by side: 2 ⨯ 2 = 4in fills the label width
// with no gap on the vertical centerline; the 0.5in of spare height is split above & below.
// So one sheet holds 8 labels ⨯ 2 = 16 QR codes (the default --count).
const SHEET = {
	width: 8.5,
	height: 11,
	cols: 2,
	rows: 4,
	label: { width: 4, height: 2.5 },
	margin: { top: 0.5, left: 0.2 },
	gutter: { x: 0.1, y: 0 },
	qr: { size: 2, perLabel: 2 },
}
const qrPerSheet = SHEET.cols * SHEET.rows * SHEET.qr.perLabel

// One <image>-per-QR sheet (links the standalone qr/*.svg files; `files` is ≤ qrPerSheet long).
function buildSheet(files) {
	const { cols, label, margin, gutter, qr } = SHEET
	const images = files.map((file, i) => {
		const slot = i % qr.perLabel
		const labelIdx = Math.floor(i / qr.perLabel)
		const col = labelIdx % cols
		const row = Math.floor(labelIdx / cols)
		const x = margin.left + col * (label.width + gutter.x) + slot * qr.size
		const y = margin.top + row * (label.height + gutter.y) + (label.height - qr.size) / 2
		return `\t<image href="qr/${file}" x="${x}" y="${y}" width="${qr.size}" height="${qr.size}" />`
	})
	return [
		`<svg xmlns="http://www.w3.org/2000/svg" width="${SHEET.width}in" height="${SHEET.height}in" viewBox="0 0 ${SHEET.width} ${SHEET.height}">`,
		'<title>Join Yggdrasil’s Black Team: Single-Use Account Creation Links</title>',
		...images,
		'</svg>',
		'',
	].join('\n')
}

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
const qrFiles = []
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
	qrFiles.push(file)
}

writeFileSync(join(dir, 'addresses.txt'), `${addresses.join('\n')}\n`)
writeFileSync(join(dir, 'links.txt'), `${links.join('\n')}\n`)

// Printable sheet(s): 16 QR codes each, on 8.5⨯11in of eight 4⨯2.5in labels.
const sheetCount = Math.ceil(n / qrPerSheet)
const sheetPad = String(sheetCount).length
for (let s = 0; s < sheetCount; s++) {
	const slice = qrFiles.slice(s * qrPerSheet, (s + 1) * qrPerSheet)
	const name = `sheet-${String(s + 1).padStart(sheetPad, '0')}.svg`
	writeFileSync(join(dir, name), buildSheet(slice))
}

console.log(`Wrote ${n} claim set(s) to ${dir}/`)
console.log('  addresses.txt — whitelist these (paste into /whitelist → bulkWhitelist)')
console.log('  links.txt     — distribute one per claimant (each embeds its key)')
console.log(`  qr/           — ${n} QR codes (error correction Q ≈ 25%) of the links`)
console.log(`  sheet-*.svg   — ${sheetCount} printable 8.5⨯11in label sheet(s), 16 QR codes each`)
console.log(`base URL: ${baseUrl}`)
