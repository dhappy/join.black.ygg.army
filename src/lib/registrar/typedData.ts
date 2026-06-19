import type { Address, TypedDataDomain } from 'viem';

// EIP-712 Registration typed data per contracts/registrar-interface.md. The domain binds the
// signature to a specific registrar + chain to defeat cross-contract/cross-chain replay.
export const registrationTypes = {
	Registration: [
		{ name: 'label', type: 'string' },
		{ name: 'target', type: 'address' }
	]
} as const;

export interface RegistrationDomainParams {
	registrarName: string;
	registrarVersion: string;
	chainId: number;
	verifyingContract: Address;
}

export function registrationDomain(params: RegistrationDomainParams): TypedDataDomain {
	return {
		name: params.registrarName,
		version: params.registrarVersion,
		chainId: params.chainId,
		verifyingContract: params.verifyingContract
	};
}

export interface RegistrationMessage {
	label: string;
	target: Address;
}
