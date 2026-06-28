# Phase 1 Data Model: One-Time ENS Name Registration

This is a frontend-only app with no database. The "data model" is (a) the in-memory client state and
its state machine, and (b) the on-chain records the app reads/writes. Validation rules are traced to
the spec's functional requirements (FR-xxx).

## Client state

### ClaimSession (in-memory, ephemeral)

| Field | Type | Notes |
|-------|------|-------|
| `embeddedKey` | bytes (secret) | Base64url-decoded from the URL fragment (32-byte secp256k1 key); in memory only; never logged/stored/sent (FR-001, FR-010). |
| `signerAddress` | address | Derived from `embeddedKey`; the whitelist identity (FR-006). |
| `labelInput` | string | Raw user input. |
| `labelNormalized` | string \| null | ENSIP-15 normalization of `labelInput`; `null` if it fails (FR-003). |
| `fqName` | string \| null | `${labelNormalized}.${POSTFIX}` once valid. |
| `targetAddress` | address \| null | The address the name resolves to (FR-002). |
| `signature` | hex string \| null | EIP-712 signature over `{label, target}` (FR-004). |
| `userOpHash` | hex string \| null | Hash of the submitted UserOperation. |
| `txHash` | hex string \| null | Mined transaction hash from the UserOp receipt. |
| `error` | typed error \| null | Categorized failure (see Error categories). |
| `state` | enum | See state machine below. |

Note: `embeddedKey` and `signature` MUST be excluded from any log/telemetry/error payload (FR-010,
Principle III).

### State machine

```text
LoadingLink ──► MissingKey             (no `#k=` key in the link → FR-008)
LoadingLink ──► InvalidLink            (key present but malformed → FR-008)
LoadingLink ──► CheckingWhitelist
CheckingWhitelist ──► NotAuthorized    (signer not on whitelist → FR-008)
CheckingWhitelist ──► AlreadyRedeemed  (whitelist entry already used → FR-008, FR-013)
CheckingWhitelist ──► Ready
Ready ──► Ready                        (live label/address validation → FR-003)
Ready ──► Signing                      (submit pressed, inputs valid)
Signing ──► Submitting                 (signature produced → FR-004)
Submitting ──► Pending                 (UserOp accepted by bundler → FR-005)
Pending ──► Success                    (registration mined → FR-007)
Pending ──► Failed                     (revert / sponsorship / network → FR-012)
Submitting ──► NameTaken               (availability lost at submit → FR-009)
Failed ──► Ready                       (safe retry → FR-012)
Success ──► (terminal; reopen shows AlreadyRedeemed → FR-013)
```

Accessibility: each transition moves focus to the new primary region and announces status via an
`aria-live` region (Principle I).

## Validation rules

| Field | Rule | Source |
|-------|------|--------|
| `embeddedKey` | `k` must be present (else `MissingKey`) and base64url-decode to exactly 32 bytes forming a valid secp256k1 key (else `InvalidLink`). | FR-001, FR-008 |
| `labelInput` | Must ENSIP-15-normalize successfully; normalized form shown before submit. | FR-003 |
| `labelNormalized` | Must be available under the postfix (registrar read) before/at submit. | FR-009 |
| `targetAddress` | Must be a well-formed EVM address (checksum-tolerant). | FR-003 |
| `signerAddress` | Must be present and unused on the whitelist for registration to proceed. | FR-006 |
| name uniqueness | Enforced on-chain; client surfaces `NameTaken` if lost to a race. | FR-009, edge cases |

## Error categories (distinct, actionable — FR-008, FR-012, SC-007)

- `MissingKey` — no `k` key present in the link at all.
- `InvalidLink` — key present but malformed (bad base64url / wrong length / invalid secp256k1 key).
- `NotAuthorized` — signer not on the whitelist.
- `AlreadyRedeemed` — whitelist entry already consumed (also the post-success reopen state).
- `InvalidLabel` — label fails ENSIP-15 normalization.
- `InvalidAddress` — target address malformed.
- `NameTaken` — label already registered under the postfix.
- `SponsorshipFailed` — Paymaster declined/unfunded.
- `SubmissionFailed` — bundler/network/revert (retryable).

## On-chain records (read/written; defined fully in `contracts/registrar-interface.md`)

### WhitelistEntry (read)

A single `uint256` per address — a role bitfield while unused, or the redeem block height once a
claimant has been consumed. Decoded by `decodeWhitelist` (see `contracts/registrar-interface.md`).

| Field | Type | Notes |
|-------|------|-------|
| `account` | address | The signer address (key derived) or admin wallet. |
| `sentinel` | uint256 | Role flags (`CLAIMANT`/`WHITELISTER`/`ADMIN`/`SUPERADMIN`) when `< 2**8`; otherwise the block height it was redeemed at (`used`). |

### ClaimedName (written)

| Field | Type | Notes |
|-------|------|-------|
| `label` | string | ENSIP-15-normalized label. |
| `node` | bytes32 | Namehash of `${label}.${POSTFIX}`. |
| `target` | address | Forward-resolution target the name maps to. |
| `resolutionTarget` | address | The address the subname resolves to (the claimant input). |
| `controller` | n/a | The postfix/registrar retains node control; no ownership is transferred to the claimant. |

State transition for a name: `available → registered` (one-way; no edit/transfer/renew in scope).
