import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// Privacy guard (FR-010, SC-005): the modules that handle the embedded key and signature must never
// log them. Logging is the most likely accidental exfiltration path in a client-only app, so we
// assert these modules contain no console.* calls at all.
const SECRET_MODULES = ['claim/link.ts', 'registrar/sign.ts', 'claim/register.ts', 'aa/account.ts'];

const here = dirname(fileURLToPath(import.meta.url));

describe('privacy: secret-handling modules do not log', () => {
	for (const relativePath of SECRET_MODULES) {
		it(`${relativePath} contains no console.* calls`, () => {
			const source = readFileSync(resolve(here, relativePath), 'utf8');
			expect(source).not.toMatch(/console\s*\./);
		});
	}
});
