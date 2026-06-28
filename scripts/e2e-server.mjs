#!/usr/bin/env node
// E2E orchestrator: start Anvil, deploy MockRegistrar, set up whitelist states, then run the dev
// server with the deployment baked into PUBLIC_* config. Used as the Playwright webServer.
// Covers the non-submission flows (NotAuthorized / AlreadyRedeemed / form validation); the gasless
// success path needs a real bundler + Paymaster and is out of scope here.
import { spawn, spawnSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { createServer } from 'node:net'
import { createPublicClient, createWalletClient, http } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { foundry } from 'viem/chains'

const RPC = 'http://127.0.0.1:8545'
const ARTIFACT = 'test-contracts/out/MockRegistrar.sol/MockRegistrar.json'
const NAME = 'MockRegistrar'
const VERSION = '1'
const POSTFIX = 'black.ygg.army'
const TARGET = '0xd8da6bf26964af9d7eed9e03e53415d37aa96045'

// Anvil default accounts (well-known): [0] deployer/relayer, [1] whitelisted+unused (Ready),
// [2] whitelisted then consumed (AlreadyRedeemed), [3] never whitelisted (NotAuthorized).
const DEPLOYER = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80'
const READY_KEY = '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d'
const USED_KEY = '0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a'

let anvil
let vite

function shutdown() {
	if (anvil) anvil.kill()
	if (vite) vite.kill()
	process.exit(0)
}
process.on('SIGTERM', shutdown)
process.on('SIGINT', shutdown)

// Fail fast on a port conflict so a leftover server can't serve a stale build (confusing 404s).
function portFree(port) {
	return new Promise((resolve) => {
		const probe = createServer()
		probe.once('error', () => resolve(false))
		probe.once('listening', () => probe.close(() => resolve(true)))
		probe.listen(port, '127.0.0.1')
	})
}
for (const [port, what] of [[8545, 'Anvil RPC'], [6666, 'web server']]) {
	if (!(await portFree(port))) {
		console.error(`Port ${port} (${what}) is already in use — stop the previous run (lsof -ti tcp:${port} | xargs -r kill -9)`)
		process.exit(1)
	}
}

if (!existsSync(ARTIFACT)) {
	spawnSync('forge', ['build', '--root', 'test-contracts'], { stdio: 'inherit' })
}
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

const wallet = createWalletClient({
	account: privateKeyToAccount(DEPLOYER),
	chain: foundry,
	transport: http(RPC),
})

const deployHash = await wallet.deployContract({
	abi: artifact.abi,
	bytecode: artifact.bytecode.object,
	args: [NAME, VERSION],
})
const registrar = (await publicClient.waitForTransactionReceipt({ hash: deployHash })).contractAddress

for (const key of [READY_KEY, USED_KEY]) {
	const hash = await wallet.writeContract({
		address: registrar,
		abi: artifact.abi,
		functionName: 'allow',
		args: [privateKeyToAccount(key).address],
	})
	await publicClient.waitForTransactionReceipt({ hash })
}

// A used claimant is marked with the block height, which must sit above the role-flag byte
// (register() guards block.number >= 2**8). Mine past that before consuming the USED key.
await publicClient.request({ method: 'anvil_mine', params: ['0x100'] })

// Consume the USED key's whitelist entry so it reports used=true (AlreadyRedeemed).
const usedSignature = await privateKeyToAccount(USED_KEY).signTypedData({
	domain: { name: NAME, version: VERSION, chainId: foundry.id, verifyingContract: registrar },
	types: { Registration: [{ name: 'label', type: 'string' }, { name: 'target', type: 'address' }] },
	primaryType: 'Registration',
	message: { label: 'taken', target: TARGET },
})
const consumeHash = await wallet.writeContract({
	address: registrar,
	abi: artifact.abi,
	functionName: 'register',
	args: ['taken', TARGET, usedSignature],
})
await publicClient.waitForTransactionReceipt({ hash: consumeHash })

// Build with the deployment baked into PUBLIC_* config ($env/dynamic/public is snapshot into the
// static build), then serve `build/` via sirv (a plain static server). (`vite dev` is avoided — under
// sandboxes; preview serves the prerendered static output.)
const buildEnv = {
	...process.env,
	PUBLIC_CHAIN_ID: String(foundry.id),
	PUBLIC_RPC_URL: RPC,
	PUBLIC_REGISTRAR_ADDRESS: registrar,
	PUBLIC_POSTFIX: POSTFIX,
	PUBLIC_REGISTRAR_NAME: NAME,
	PUBLIC_REGISTRAR_VERSION: VERSION,
}
spawnSync('pnpm', ['exec', 'vite', 'build'], { stdio: 'inherit', env: buildEnv })
vite = spawn(
	'pnpm',
	['exec', 'sirv', 'build', '--port', '6666', '--host', '127.0.0.1', '--single', '--quiet'],
	{ stdio: 'ignore' },
)
