# Contract: Gasless Integration (Alchemy Account Kit + Gas Manager)

How the app delivers the `register` call gaslessly, via **Alchemy Account Kit** (Modular Account v2)
with a **Gas Manager** sponsorship policy. Packages: `@account-kit/smart-contracts`,
`@account-kit/infra`, `@aa-sdk/core`.

## Flow

1. Build a **Modular Account v2** client owned by the embedded key:
   `createModularAccountV2Client({ chain, transport: alchemy({ apiKey }), signer: LocalAccountSigner.privateKeyToAccountSigner(key), policyId })`.
   The `policyId` (Gas Manager) makes the client request sponsorship automatically.
2. Encode `data` = `registrar.register(label, target, signature)` where `signature` is the EIP-712
   signature from `contracts/registrar-interface.md`.
3. Send a sponsored UserOperation: `client.sendUserOperation({ uo: { target: REGISTRAR, data } })`
   → `{ hash }`. Gas is covered by the policy; the claimant pays nothing (FR-005, SC-002).
4. Await the on-chain tx: `client.waitForUserOperationTransaction({ hash })` → the transaction hash.
   On success → `Success` (the `Registered` event is emitted); on revert/sponsorship/network
   failure → `Failed` (FR-012).

Authorization note: the registrar checks the **recovered `(label,target)` signer**, independent of
the Modular Account sender — the AA account is only the gasless transport (clarify Q3).

## Configuration the app needs (public, build-time)

| Key | Meaning |
|-----|---------|
| `PUBLIC_ALCHEMY_API_KEY` | Alchemy app API key (used by the bundler + Gas Manager transport). |
| `PUBLIC_GAS_POLICY_ID` | Gas Manager sponsorship policy id. |

These ship in the static bundle (the app has no backend), so the key MUST be **domain-allowlisted**
in the Alchemy dashboard and the gas policy MUST be **scoped** (allowed sender/contract + spend
caps) to prevent abuse. `createSponsoredClient` throws `MissingAlchemyConfig` when either is absent,
so reads / the admin UI / local dev keep working without them. The target chain must be an
Alchemy-supported chain (resolved by `alchemyChain(chainId)` in `src/lib/chain/client.ts`).

## Failure modes the app handles (FR-012)

- Sponsorship declined/unavailable (policy cap, scope mismatch) → surfaced as a submission failure.
- Bundler/network error or on-chain revert → `SubmissionFailed` (retryable).
- Availability lost between pre-check and inclusion (race) → registrar reverts → `NameTaken`.
