import { describe, expect, it } from 'vitest';
import { decodeFunctionData, getAddress, recoverTypedDataAddress } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { encodeRegisterCall, signRegistration, type SignRegistrationParams } from './sign';
import { registrarAbi } from './abi';
import { registrationDomain, registrationTypes } from './typedData';

const KEY = '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d' as const;
const TARGET = getAddress('0xd8da6bf26964af9d7eed9e03e53415d37aa96045');
const REGISTRAR = getAddress('0x70997970c51812dc3a010c7d01b50e0d17dc79c8');

const params: SignRegistrationParams = {
	privateKey: KEY,
	registrarName: 'BlackYggArmyRegistrar',
	registrarVersion: '1',
	chainId: 8453,
	verifyingContract: REGISTRAR,
	label: 'alice',
	target: TARGET
};

describe('signRegistration', () => {
	it('produces a signature that recovers to the signing key', async () => {
		const signature = await signRegistration(params);
		const recovered = await recoverTypedDataAddress({
			domain: registrationDomain(params),
			types: registrationTypes,
			primaryType: 'Registration',
			message: { label: params.label, target: params.target },
			signature
		});
		expect(recovered).toBe(privateKeyToAccount(KEY).address);
	});
});

describe('encodeRegisterCall', () => {
	it('encodes the register calldata that round-trips through the ABI', () => {
		const data = encodeRegisterCall('alice', TARGET, '0xdeadbeef');
		const decoded = decodeFunctionData({ abi: registrarAbi, data });
		expect(decoded.functionName).toBe('register');
		expect(decoded.args).toEqual(['alice', TARGET, '0xdeadbeef']);
	});
});
