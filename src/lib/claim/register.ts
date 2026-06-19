import type { Address, Hex } from 'viem';
import { loadConfig } from '../chain/config';
import { fullyQualifiedName } from '../ens/normalize';
import { isNameAvailable } from '../registrar/reads';
import { encodeRegisterCall, signRegistration } from '../registrar/sign';
import { createSponsoredClient } from '../aa/account';

export interface RegisterRequest {
	privateKey: Hex;
	label: string; // already ENSIP-15 normalized
	target: Address;
}

export interface RegisterResult {
	fqName: string;
	txHash: Hex;
}

// Compose the gasless registration: pre-check availability, sign (label,target), then send a
// Paymaster-sponsored UserOperation invoking register() and wait for its receipt (FR-005/FR-009).
export async function registerName(request: RegisterRequest): Promise<RegisterResult> {
	const cfg = loadConfig();
	const registrar = cfg.registrarAddress as Address;

	if (!(await isNameAvailable(request.label))) throw new Error('NameTaken');

	const signature = await signRegistration({
		privateKey: request.privateKey,
		registrarName: cfg.registrarName,
		registrarVersion: cfg.registrarVersion,
		chainId: cfg.chainId,
		verifyingContract: registrar,
		label: request.label,
		target: request.target
	});
	const data = encodeRegisterCall(request.label, request.target, signature);

	const { account, bundler } = await createSponsoredClient(request.privateKey);
	const userOpHash = await bundler.sendUserOperation({
		account,
		calls: [{ to: registrar, data }]
	});
	const receipt = await bundler.waitForUserOperationReceipt({ hash: userOpHash });

	return {
		fqName: fullyQualifiedName(request.label, cfg.postfix),
		txHash: receipt.receipt.transactionHash
	};
}
