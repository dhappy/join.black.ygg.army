import { http } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import {
	DEFAULT_MEE_VERSION,
	createMeeClient,
	getDefaultMEENetworkApiKey,
	getDefaultMEENetworkUrl,
	getDefaultMeeGasTank,
	getMEEVersion,
	toMultichainNexusAccount
} from '@biconomy/abstractjs'
import type { Hex } from 'viem'
import { appChain } from '../chain/client'
import { loadConfig } from '../chain/config'

// Gasless via Biconomy MEE testnet sponsorship (https://docs.biconomy.io/gasless-apps/testnet-sponsorship).
// The embedded key signs a Nexus smart account; the SDK's staging MEE network + shared testnet gas
// tank sponsor gas out of the box — no bundler/Paymaster URLs or dashboard setup required.
export async function createSponsoredMeeClient(privateKey: Hex) {
	const account = await toMultichainNexusAccount({
		chainConfigurations: [
			{
				chain: appChain(),
				transport: http(loadConfig().rpcUrl),
				version: getMEEVersion(DEFAULT_MEE_VERSION)
			}
		],
		signer: privateKeyToAccount(privateKey)
	})
	return createMeeClient({
		account,
		url: getDefaultMEENetworkUrl(true),
		apiKey: getDefaultMEENetworkApiKey(true)
	})
}

// Testnet sponsorship options for meeClient.execute({ sponsorship: true, sponsorshipOptions }).
export function testnetSponsorshipOptions() {
	return {
		url: getDefaultMEENetworkUrl(true),
		gasTank: getDefaultMeeGasTank(true)
	}
}
