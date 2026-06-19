import type { Address, Hex } from 'viem';
import type { ParsedClaimLink } from './link';

// Distinct, actionable error categories (FR-008, FR-012, SC-007).
export type ErrorCategory =
	| 'InvalidLink'
	| 'NotAuthorized'
	| 'AlreadyRedeemed'
	| 'InvalidLabel'
	| 'InvalidAddress'
	| 'NameTaken'
	| 'SponsorshipFailed'
	| 'SubmissionFailed';

// Claim session states (data-model.md state machine).
export type ClaimState =
	| { kind: 'LoadingLink' }
	| { kind: 'CheckingWhitelist'; signer: Address }
	| { kind: 'InvalidLink' }
	| { kind: 'NotAuthorized'; signer: Address }
	| { kind: 'AlreadyRedeemed'; signer: Address }
	| { kind: 'Ready'; signer: Address }
	| { kind: 'Submitting'; signer: Address }
	| { kind: 'Pending'; signer: Address; userOpHash: Hex }
	| { kind: 'Success'; fqName: string; target: Address; txHash: Hex }
	| { kind: 'Failed'; signer: Address; error: ErrorCategory };

// A parsed link becomes either an invalid-link terminal state or a whitelist check.
export function stateForLink(parsed: ParsedClaimLink): ClaimState {
	if (!parsed.ok) return { kind: 'InvalidLink' };
	return { kind: 'CheckingWhitelist', signer: parsed.signerAddress };
}

// Whitelist read resolves to Ready / NotAuthorized / AlreadyRedeemed (also covers the post-success
// reopen case, since a consumed entry reports used=true → AlreadyRedeemed).
export function stateForWhitelist(
	signer: Address,
	whitelist: { authorized: boolean; used: boolean }
): ClaimState {
	if (!whitelist.authorized) return { kind: 'NotAuthorized', signer };
	if (whitelist.used) return { kind: 'AlreadyRedeemed', signer };
	return { kind: 'Ready', signer };
}
