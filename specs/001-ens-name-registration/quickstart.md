# Quickstart: One-Time ENS Name Registration

A run/validation guide proving the feature works end-to-end. Implementation details live in
`tasks.md` (Phase 2) and the code; this file is how you set up, run, and validate.

## Prerequisites

- Node.js (LTS) and **pnpm**
- **Foundry** (`anvil`, `forge`, `cast`) for a local chain + mock registrar (integration tests)
- A local or hosted **ERC-4337 bundler + Paymaster** for E2E (e.g., Pimlico `alto` locally, or a
  testnet bundler/Paymaster such as Base Sepolia)
- A deployed (or mock) **registrar** matching `contracts/registrar-interface.md`

## Scaffold (first time)

```bash
pnpx sv create .            # TypeScript template; add-ons: eslint, vitest, playwright, sveltekit-adapter (static) — no prettier
pnpm install
pnpm add viem permissionless @adraffy/ens-normalize
```

## Configure (public, build-time)

Provide public config (no secrets) — see the config tables in `contracts/registrar-interface.md` and
`contracts/erc4337-integration.md`:

```bash
# .env (PUBLIC values only — no private keys, no secret API keys)
PUBLIC_CHAIN_ID=...           PUBLIC_RPC_URL=...
PUBLIC_REGISTRAR_ADDRESS=...  PUBLIC_POSTFIX=black.ygg.army
PUBLIC_REGISTRAR_NAME=...     PUBLIC_REGISTRAR_VERSION=1
PUBLIC_ENTRYPOINT_ADDRESS=... PUBLIC_BUNDLER_URL=...   PUBLIC_PAYMASTER_URL=...
```

## Run

```bash
pnpm dev          # local dev server
pnpm build        # static production build (adapter-static)
pnpm preview      # serve the static build
```

## Validate

### Unit (fast, no chain)

```bash
pnpm test:unit
```

Expected: ENSIP-15 normalization accepts/normalizes valid labels and rejects invalid ones; address
validation works; EIP-712 signature and `register` calldata encode as specified.

### Integration (local chain)

```bash
anvil &                         # local node
# deploy the mock registrar + whitelist a known signer (see tests/integration setup)
pnpm test:integration
```

Expected: `whitelist(signer)` and `available(label)` reads return correctly; a sponsored `register`
registers the name and emits `Registered`; a second attempt with the same key reverts (single use).

### End-to-end (full flow + accessibility)

```bash
pnpm test:e2e
```

Scenarios proven (trace to spec):

| Scenario | Expected | Spec |
|----------|----------|------|
| Open valid unused link → enter available label + address → submit | Registration succeeds, success card shows fully-qualified name; claimant pays no gas | US1 / FR-005, FR-007, SC-001, SC-002 |
| Reopen a redeemed link | Shows `AlreadyRedeemed`, no new claim | US2 / FR-013, SC-003 |
| Non-whitelisted link | Shows `NotAuthorized` | US2 / FR-008 |
| Invalid label / malformed address | Inline error before submit; normalized form shown | US3 / FR-003 |
| Name taken (race) | `NameTaken`, prompt to choose another | US3 / FR-009 |
| Sponsorship/submission failure | Actionable error, safe retry | US3 / FR-012, SC-007 |
| Axe accessibility on every state | No WCAG 2.2 AA violations; keyboard + screen-reader pass | FR-011, SC-006 |

### Privacy check (manual + automated)

Confirm the key (fragment) never appears in any network request, log, or storage — assert zero
egress containing `k`/the key (SC-005, FR-010).

## Manual smoke

1. `pnpm build && pnpm preview`.
2. Open `…/#k=<base64url test key whitelisted on your test chain>`.
3. Enter a free label + a target address; submit; confirm the success card and the on-chain
   `Registered` event; confirm no wallet prompt and no gas paid.
