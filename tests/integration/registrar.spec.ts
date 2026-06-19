import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
	createPublicClient,
	createWalletClient,
	getAddress,
	http,
	parseEventLogs,
	type Address
} from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { foundry } from 'viem/chains'
import { registrarAbi } from '../../src/lib/registrar/abi'
import { signRegistration } from '../../src/lib/registrar/sign'

const here = dirname(fileURLToPath(import.meta.url))
const deployment = JSON.parse(readFileSync(resolve(here, '.deployment.json'), 'utf8')) as {
	rpc: string
	registrar: Address
	name: string
	version: string
	chainId: number
}

// The relayer is anvil[0] — a funded account that is NOT the signer, exercising the clarified
// design where the registrar recovers the signer from the signature, independent of msg.sender.
const RELAYER = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80'
const SIGNER_KEY = '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d' // whitelisted
const OUTSIDER_KEY = '0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a' // not whitelisted
const TARGET = getAddress('0xd8da6bf26964af9d7eed9e03e53415d37aa96045')

const relayer = privateKeyToAccount(RELAYER)
const publicClient = createPublicClient({ chain: foundry, transport: http(deployment.rpc) })
const walletClient = createWalletClient({ account: relayer, chain: foundry, transport: http(deployment.rpc) })

function sign(privateKey: `0x${string}`, label: string) {
	return signRegistration({
		privateKey,
		registrarName: deployment.name,
		registrarVersion: deployment.version,
		chainId: deployment.chainId,
		verifyingContract: deployment.registrar,
		label,
		target: TARGET
	})
}

describe('MockRegistrar integration', () => {
	it('registers a name from a relayer submission and emits Registered (US1)', async () => {
		const signature = await sign(SIGNER_KEY, 'alice')
		const { request } = await publicClient.simulateContract({
			account: relayer,
			address: deployment.registrar,
			abi: registrarAbi,
			functionName: 'register',
			args: ['alice', TARGET, signature]
		})
		const hash = await walletClient.writeContract(request)
		const receipt = await publicClient.waitForTransactionReceipt({ hash })
		expect(receipt.status).toBe('success')

		const logs = parseEventLogs({ abi: registrarAbi, eventName: 'Registered', logs: receipt.logs })
		expect(logs[0].args.target).toBe(TARGET)
		expect(logs[0].args.registrant).toBe(privateKeyToAccount(SIGNER_KEY).address)

		const available = await publicClient.readContract({
			address: deployment.registrar,
			abi: registrarAbi,
			functionName: 'available',
			args: ['alice']
		})
		expect(available).toBe(false)
	})

	it('rejects reuse of an already-used whitelist entry (US2)', async () => {
		const signature = await sign(SIGNER_KEY, 'bob')
		await expect(
			publicClient.simulateContract({
				account: relayer,
				address: deployment.registrar,
				abi: registrarAbi,
				functionName: 'register',
				args: ['bob', TARGET, signature]
			})
		).rejects.toThrow(/already used/)
	})

	it('rejects a non-whitelisted signer (US2)', async () => {
		const signature = await sign(OUTSIDER_KEY, 'charlie')
		await expect(
			publicClient.simulateContract({
				account: relayer,
				address: deployment.registrar,
				abi: registrarAbi,
				functionName: 'register',
				args: ['charlie', TARGET, signature]
			})
		).rejects.toThrow(/not whitelisted/)
	})

	it('reports whitelist status for a recovered signer', async () => {
		const [authorized, used] = await publicClient.readContract({
			address: deployment.registrar,
			abi: registrarAbi,
			functionName: 'whitelist',
			args: [privateKeyToAccount(SIGNER_KEY).address]
		})
		expect(authorized).toBe(true)
		expect(used).toBe(true) // consumed by the first test
	})
})
