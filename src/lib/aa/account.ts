import { LocalAccountSigner } from '@aa-sdk/core'
import { alchemy } from '@account-kit/infra'
import { createModularAccountV2Client } from '@account-kit/smart-contracts'
import type { Hex } from 'viem'
import { alchemyChain } from '../chain/client'
import { loadConfig } from '../chain/config'

// Gasless via Alchemy: a Modular Account v2 owned by the embedded key sends the UserOperation, with
// gas sponsored by an Alchemy Gas Manager policy (policyId). The registrar recovers the
// (label, target) signer from the calldata signature, so this account being a distinct address is
// fine — it's only the gasless transport (clarify Q3).
export async function createSponsoredClient(privateKey: Hex) {
	const cfg = loadConfig()
	if (!cfg.alchemyApiKey || !cfg.gasPolicyId) throw new Error('MissingAlchemyConfig')

	return createModularAccountV2Client({
		chain: alchemyChain(cfg.chainId),
		transport: alchemy({ apiKey: cfg.alchemyApiKey }),
		signer: LocalAccountSigner.privateKeyToAccountSigner(privateKey),
		policyId: cfg.gasPolicyId,
	})
}
