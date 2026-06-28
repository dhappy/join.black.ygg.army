import type { Address, Hex } from 'viem'
import { loadConfig } from '../chain/config'
import { fullyQualifiedName } from '../ens/normalize'
import { isNameAvailable } from '../registrar/reads'
import { encodeRegisterCall, signRegistration } from '../registrar/sign'
import { createSponsoredClient } from '../aa/account'

export interface RegisterRequest {
	privateKey: Hex
	label: string // already ENSIP-15 normalized
	target: Address
}

export interface RegisterResult {
	fqName: string
	txHash: Hex
}

// Compose the gasless registration: pre-check availability, sign (label,target), then submit a
// gas-sponsored UserOperation invoking register() via an Alchemy Modular Account v2 + Gas Manager,
// and wait for the on-chain transaction (FR-005/FR-009). The registrar recovers the signer from the
// calldata signature, so the smart account that sends the call need not be the key holder.
export async function registerName(request: RegisterRequest): Promise<RegisterResult> {
	const cfg = loadConfig()
	const registrar = cfg.registrarAddress as Address

	if (!(await isNameAvailable(request.label))) throw new Error('NameTaken')

	const signature = await signRegistration({
		privateKey: request.privateKey,
		registrarName: cfg.registrarName,
		registrarVersion: cfg.registrarVersion,
		chainId: cfg.chainId,
		verifyingContract: registrar,
		label: request.label,
		target: request.target,
	})
	const data = encodeRegisterCall(request.label, request.target, signature)

	const client = await createSponsoredClient(request.privateKey)
	const { hash } = await client.sendUserOperation({ uo: { target: registrar, data } })
	const txHash = await client.waitForUserOperationTransaction({ hash })

	return { fqName: fullyQualifiedName(request.label, cfg.postfix), txHash }
}
