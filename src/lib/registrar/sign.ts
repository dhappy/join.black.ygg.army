import { encodeFunctionData } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import type { Address, Hex } from 'viem'
import { registrarAbi } from './abi'
import { registrationDomain, registrationTypes, type RegistrationDomainParams } from './typedData'

export interface SignRegistrationParams extends RegistrationDomainParams {
	privateKey: Hex
	label: string
	target: Address
}

// Sign the (label, target) pair with the embedded key (FR-004). The normalized label must be
// passed in so the signature matches what gets registered.
export async function signRegistration(params: SignRegistrationParams): Promise<Hex> {
	const account = privateKeyToAccount(params.privateKey)
	return account.signTypedData({
		domain: registrationDomain(params),
		types: registrationTypes,
		primaryType: 'Registration',
		message: { label: params.label, target: params.target }
	})
}

export function encodeRegisterCall(label: string, target: Address, signature: Hex): Hex {
	return encodeFunctionData({
		abi: registrarAbi,
		functionName: 'register',
		args: [label, target, signature]
	})
}
