import type { Address, Hex } from 'viem'
import type { ParsedClaimLink } from './link'
import { stateForLink, stateForWhitelist, type ClaimState, type ErrorCategory } from './state'

// Runes-based claim session store. All transition logic lives in ./state (pure, unit-tested); this
// is the reactive wrapper the UI binds to.
export function createClaimSession() {
	let state = $state<ClaimState>({ kind: 'LoadingLink' })
	let privateKey = $state<Hex | null>(null)

	return {
		get state() {
			return state
		},
		get privateKey() {
			return privateKey
		},
		fromLink(parsed: ParsedClaimLink) {
			state = stateForLink(parsed)
			privateKey = parsed.ok ? parsed.privateKey : null
		},
		resolveWhitelist(signer: Address, whitelist: { authorized: boolean, used: boolean }) {
			state = stateForWhitelist(signer, whitelist)
		},
		submitting(signer: Address) {
			state = { kind: 'Submitting', signer }
		},
		succeeded(fqName: string, target: Address, txHash: Hex) {
			state = { kind: 'Success', fqName, target, txHash }
		},
		failed(signer: Address, error: ErrorCategory) {
			state = { kind: 'Failed', signer, error }
		},
		retry() {
			if (state.kind === 'Failed') state = { kind: 'Ready', signer: state.signer }
		},
	}
}
