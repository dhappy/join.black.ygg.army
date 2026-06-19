import { describe, expect, it } from 'vitest';
import { hexToBytes } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { parseClaimLink, toBase64Url } from './link';

// A well-known test private key (Hardhat account #1); its address is derived, not hardcoded.
const KEY_HEX = '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d' as const;

describe('parseClaimLink', () => {
	it('parses a valid claim link round-trip', () => {
		const encoded = toBase64Url(hexToBytes(KEY_HEX));
		const expected = privateKeyToAccount(KEY_HEX);
		expect(parseClaimLink(`#k=${encoded}`)).toEqual({
			ok: true,
			privateKey: KEY_HEX,
			signerAddress: expected.address
		});
	});

	it('reports missing when there is no k param', () => {
		expect(parseClaimLink('#')).toEqual({ ok: false, reason: 'missing' });
		expect(parseClaimLink('')).toEqual({ ok: false, reason: 'missing' });
	});

	it('reports malformed on invalid base64url', () => {
		expect(parseClaimLink('#k=@@@@')).toEqual({ ok: false, reason: 'malformed' });
	});

	it('reports malformed when the key is not 32 bytes', () => {
		const short = toBase64Url(new Uint8Array(31));
		expect(parseClaimLink(`#k=${short}`)).toEqual({ ok: false, reason: 'malformed' });
	});
});
