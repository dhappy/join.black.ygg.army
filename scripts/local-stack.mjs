#!/usr/bin/env node

// Manual local test stack: Anvil + deployed MockRegistrar + the app served with the deployment
// baked into PUBLIC_* config (via build + sirv static server). Prints claim links for each state.
// Not used by CI; for hand-testing in a browser. Stop with Ctrl-C.
import { spawn, spawnSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { createPublicClient, createWalletClient, hexToBytes, http } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { foundry } from 'viem/chains'

const PORT = 8080
const RPC = 'http://127.0.0.1:8545'
const ARTIFACT = 'test-contracts/out/MockRegistrar.sol/MockRegistrar.json'
const NAME = 'MockRegistrar'
const VERSION = '1'
const POSTFIX = 'black.ygg.army'
const TARGET = '0xd8da6bf26964af9d7eed9e03e53415d37aa96045'

const DEPLOYER = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80' // anvil[0]
const READY_KEY = '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d' // anvil[1]
const USED_KEY = '0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a' // anvil[2]
const OUTSIDER_KEY = '0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6' // anvil[3]

function toBase64Url(bytes) {
	let binary = ''
	for (const byte of bytes) binary += String.fromCharCode(byte)
	return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function link(hexKey) {
	return `http://localhost:${PORT}/#k=${toBase64Url(hexToBytes(hexKey))}`
}

let anvil
let vite
function shutdown() {
	if (anvil) anvil.kill()
	if (vite) vite.kill()
	process.exit(0)
}
process.on('SIGTERM', shutdown)
process.on('SIGINT', shutdown)

if (!existsSync(ARTIFACT)) spawnSync('forge', ['build', '--root', 'test-contracts'], { stdio: 'inherit' })
const artifact = JSON.parse(readFileSync(ARTIFACT, 'utf8'))

anvil = spawn('anvil', ['--silent'], { stdio: 'ignore' })

const publicClient = createPublicClient({ chain: foundry, transport: http(RPC) })
for (let attempt = 0; attempt < 100; attempt++) {
	try {
		await publicClient.getChainId()
		break
	} catch {
		await new Promise((done) => setTimeout(done, 100))
	}
}

const wallet = createWalletClient({ account: privateKeyToAccount(DEPLOYER), chain: foundry, transport: http(RPC) })

const deployHash = await wallet.deployContract({ abi: artifact.abi, bytecode: artifact.bytecode.object, args: [NAME, VERSION] })
const registrar = (await publicClient.waitForTransactionReceipt({ hash: deployHash })).contractAddress

for (const key of [READY_KEY, USED_KEY]) {
	const hash = await wallet.writeContract({ address: registrar, abi: artifact.abi, functionName: 'allow', args: [privateKeyToAccount(key).address] })
	await publicClient.waitForTransactionReceipt({ hash })
}

const usedSignature = await privateKeyToAccount(USED_KEY).signTypedData({
	domain: { name: NAME, version: VERSION, chainId: foundry.id, verifyingContract: registrar },
	types: { Registration: [{ name: 'label', type: 'string' }, { name: 'target', type: 'address' }] },
	primaryType: 'Registration',
	message: { label: 'taken', target: TARGET }
})
const consumeHash = await wallet.writeContract({ address: registrar, abi: artifact.abi, functionName: 'register', args: ['taken', TARGET, usedSignature] })
await publicClient.waitForTransactionReceipt({ hash: consumeHash })

const buildEnv = {
	...process.env,
	PUBLIC_CHAIN_ID: String(foundry.id),
	PUBLIC_RPC_URL: RPC,
	PUBLIC_REGISTRAR_ADDRESS: registrar,
	PUBLIC_POSTFIX: POSTFIX,
	PUBLIC_REGISTRAR_NAME: NAME,
	PUBLIC_REGISTRAR_VERSION: VERSION
}
spawnSync('pnpm', ['exec', 'vite', 'build'], { stdio: 'inherit', env: buildEnv })
vite = spawn('pnpm', ['exec', 'sirv', 'build', '--port', String(PORT), '--host', '127.0.0.1', '--single', '--quiet'], { stdio: 'inherit' })

console.log('\n========================================================')
console.log(`  Local stack ready. Registrar deployed at ${registrar}`)
console.log('  Open these in your browser:')
console.log(`\n  READY (reaches the claim form):\n    ${link(READY_KEY)}`)
console.log(`\n  ALREADY REDEEMED:\n    ${link(USED_KEY)}`)
console.log(`\n  NOT AUTHORIZED (not whitelisted):\n    ${link(OUTSIDER_KEY)}`)
console.log(`\n  INVALID LINK:\n    http://localhost:${PORT}/#k=not-a-real-key`)
console.log('\n  Note: submitting the form will fail — there is no real bundler/Paymaster,')
console.log('  so the gasless success path is not wired locally. Everything else works.')
console.log('========================================================\n')
