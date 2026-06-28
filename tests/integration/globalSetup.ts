import { spawn, type ChildProcess } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createPublicClient, createWalletClient, http, type Abi, type Hex } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { foundry } from 'viem/chains'

const RPC = 'http://127.0.0.1:8545'
const DEPLOYER = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80' // anvil[0]
const SIGNER = '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d' // anvil[1] (whitelisted)
const NAME = 'MockRegistrar'
const VERSION = '1'

const here = dirname(fileURLToPath(import.meta.url))

const artifact = JSON.parse(
	readFileSync(resolve(here, '../../test-contracts/out/MockRegistrar.sol/MockRegistrar.json'), 'utf8')
) as { abi: Abi, bytecode: { object: Hex } }

async function waitForRpc(): Promise<void> {
	const client = createPublicClient({ chain: foundry, transport: http(RPC) })
	for (let attempt = 0; attempt < 100; attempt++) {
		try {
			await client.getChainId()
			return
		} catch {
			await new Promise((done) => setTimeout(done, 100))
		}
	}
	throw new Error('anvil did not become ready')
}

export default async function setup() {
	const anvil: ChildProcess = spawn('anvil', ['--silent', '--port', '8545'], { stdio: 'ignore' })
	await waitForRpc()

	const deployer = privateKeyToAccount(DEPLOYER)
	const wallet = createWalletClient({ account: deployer, chain: foundry, transport: http(RPC) })
	const publicClient = createPublicClient({ chain: foundry, transport: http(RPC) })

	const deployHash = await wallet.deployContract({
		abi: artifact.abi,
		bytecode: artifact.bytecode.object,
		args: [NAME, VERSION]
	})
	const deployReceipt = await publicClient.waitForTransactionReceipt({ hash: deployHash })
	const registrar = deployReceipt.contractAddress as `0x${string}`

	const signer = privateKeyToAccount(SIGNER).address
	const allowHash = await wallet.writeContract({
		address: registrar,
		abi: artifact.abi,
		functionName: 'allow',
		args: [signer]
	})
	await publicClient.waitForTransactionReceipt({ hash: allowHash })

	// A used claimant is marked with the block height, which must sit above the role-flag byte
	// (register() guards block.number >= 2**8). Mine past that before any register in the specs.
	await publicClient.request({ method: 'anvil_mine', params: ['0x100'] } as never)

	writeFileSync(
		resolve(here, '.deployment.json'),
		JSON.stringify({ rpc: RPC, registrar, name: NAME, version: VERSION, chainId: foundry.id })
	)

	return async () => {
		anvil.kill()
	}
}
