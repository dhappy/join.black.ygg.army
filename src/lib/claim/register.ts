import type { Address, Hex } from 'viem'
import { loadConfig } from '../chain/config'
import { fullyQualifiedName } from '../ens/normalize'
import { isNameAvailable } from '../registrar/reads'
import { encodeRegisterCall, signRegistration } from '../registrar/sign'
import { createSponsoredMeeClient, testnetSponsorshipOptions } from '../aa/account'

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
// Biconomy MEE sponsored supertransaction invoking register() and wait for its receipt
// (FR-005/FR-009). The registrar recovers the signer from the calldata signature, so the MEE
// account that sends the call need not be the key holder.
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
		target: request.target
	})
	const data = encodeRegisterCall(request.label, request.target, signature)

	const meeClient = await createSponsoredMeeClient(request.privateKey)
	const { hash } = await meeClient.execute({
		instructions: [{ calls: [{ to: registrar, data }], chainId: cfg.chainId }],
		sponsorship: true,
		sponsorshipOptions: testnetSponsorshipOptions()
	})
	const receipt = await meeClient.waitForSupertransactionReceipt({ hash })
	// Prefer the on-chain transaction hash (for the block-explorer link); fall back to the
	// supertransaction hash if no per-chain receipt is present.
	const txHash = receipt.receipts.at(0)?.transactionHash ?? hash

	return { fqName: fullyQualifiedName(request.label, cfg.postfix), txHash }
}
