# Phase 0 Research: One-Time ENS Name Registration

Resolves the items the spec deferred to planning (chain/network, performance targets) and the
technology choices implied by the clarified spec. Each decision lists rationale and rejected
alternatives.

## 1. Frontend framework & scaffolding

- **Decision**: Svelte 5 (runes) on SvelteKit ~2.x, scaffolded with `pnpx sv create` (TypeScript
  template) and built static via `@sveltejs/adapter-static`. Package manager: pnpm.
- **Rationale**: Required by the requester (Svelte + TypeScript). `sv create` is the current
  official scaffolder and wires up TypeScript, ESLint, Prettier, Vitest, Playwright, and the
  adapter as first-class add-ons, satisfying Principle V with no bespoke tooling. A static build
  means no server ever receives the URL fragment (Principle II/III).
- **Alternatives considered**: Plain Vite + Svelte (rejected: `sv create` gives routing, a11y
  defaults, and the test/lint add-ons for free); `npm create svelte` (rejected: superseded by
  `sv`); SSR adapters (rejected: no server component is wanted, and a static SPA keeps the key off
  any server).

## 2. Ethereum library

- **Decision**: `viem` ~2.x for key handling (`privateKeyToAccount`), EIP-712 typed-data signing,
  contract reads, and ENS normalization (`viem/ens` `normalize`, which wraps `@adraffy/ens-normalize`).
- **Rationale**: TypeScript-first, tree-shakeable, the de-facto modern base that `permissionless`
  builds on, so one consistent client stack. Bundles ENSIP-15 normalization, avoiding an extra dep.
- **Alternatives considered**: `ethers` v6 (rejected: heavier, not the base for `permissionless`,
  weaker tree-shaking); web3.js (rejected: legacy ergonomics).

## 3. Account abstraction / gasless delivery

- **Decision**: `permissionless` ~0.2 over viem. The embedded key is the **owner/signer of a
  counterfactual ERC-4337 smart account**; the claim is sent as a single Paymaster-sponsored
  UserOperation whose `callData` invokes `registrar.register(label, target, signature)`. The
  account is deployed on that first op via `initCode`.
- **Rationale**: The clarified model (registrar recovers the `(name, address)` signer from calldata;
  ERC-4337 is only the gasless transport) means the *sender* identity is irrelevant to authorization
  — so the simplest sender is a smart account owned by the same embedded key, requiring the claimant
  to hold exactly one secret. `permissionless` is viem-native and provides bundler + Paymaster
  clients and UserOp building/waiting.
- **Smart-account type**: **Safe** (audited, broad `permissionless` support) as the default,
  config-overridable. It is throwaway (one registration), so minimal features are needed.
- **Alternatives considered**: Smart-account-owner authorization where the registrar trusts
  `msg.sender` (rejected in clarify Q3 — registrar recovers the signer instead); a project-run
  relayer/meta-tx backend (rejected: adds a backend, violating the no-backend constraint); EOA + user
  pays gas (rejected by clarify Q1 — must be gasless).

## 4. Paymaster sponsorship model (keeping the client static & key-safe)

- **Decision**: Treat the bundler + Paymaster as **external infrastructure provided by deployment
  config** (consistent with the spec listing the Paymaster as an externally managed dependency). The
  recommended deployment is a **project-owned Verifying Paymaster scoped on-chain to the registrar's
  `register` selector** (and/or the registrar address), funded with gas, so the sponsorship endpoint
  the client calls carries no secret that could be abused for arbitrary sponsorship.
- **Rationale**: A static client cannot safely hold a secret Paymaster API key (Principle III). A
  Paymaster whose policy is enforced on-chain (only sponsors `register` calls to the registrar) can
  be exposed to the client without a backend. If a third-party Paymaster that requires a secret key
  is mandated instead, the *minimal* addition is a single stateless serverless function that signs
  Paymaster data only for registrar calls — explicitly out of scope here and flagged for the
  operator. The app reads bundler URL, Paymaster URL, EntryPoint, factory, and registrar address
  from public build-time config.
- **Alternatives considered**: Embedding a third-party Paymaster API key in the bundle (rejected:
  secret leakage); a full backend relayer (rejected: no-backend constraint).

## 5. Target chain / network

- **Decision**: **Chain-agnostic via configuration.** The app reads chainId, RPC URL, registrar
  address, EntryPoint, bundler URL, and Paymaster URL from public build-time config. Recommended
  target is an **EVM L2** (e.g., Base or Optimism) for low gas and mature ERC-4337 infra; local
  development/integration uses a **Foundry Anvil** fork or node, and end-to-end testing targets a
  public testnet (e.g., Base Sepolia) with a hosted bundler/Paymaster.
- **Rationale**: The registrar + Paymaster are deployed outside this app (per spec), so the concrete
  chain is an operator decision; the client must not hard-code it. L2 keeps Paymaster gas costs low.
- **Alternatives considered**: Hard-coding Ethereum mainnet (rejected: high gas for sponsorship, and
  the namespace is a custom registrar, not mainnet ENS); committing to a single chain in source
  (rejected: reduces deployability and testability).

## 6. ENS-normalized label validation (ENSIP-15)

- **Decision**: Normalize the entered label with ENSIP-15 (`viem/ens` `normalize` /
  `@adraffy/ens-normalize`). Reject labels that throw on normalization; display the normalized form
  to the claimant before submission; sign and register the **normalized** label.
- **Rationale**: Clarify Q4. Using the reference implementation avoids a bespoke, subtly-wrong
  charset policy and keeps names interoperable with ENS tooling. Signing the normalized form
  prevents a signature/registration mismatch.
- **Alternatives considered**: Custom `a–z0–9-` rule (rejected: less interoperable, easy to get
  confusable/emoji handling wrong); deferring all validation to the contract (rejected: poor UX, no
  inline feedback).

## 7. Registrar signature scheme

- **Decision**: **EIP-712 typed data** over `{ label, target }` with a domain binding to the
  registrar contract address + chainId (and a name/version). The signature is produced client-side
  by the embedded key and passed in the `register` calldata for the registrar to recover.
- **Rationale**: Domain separation binds the authorization to a specific contract + chain, defeating
  cross-contract/cross-chain replay (Principle III). Typed data is human-auditable and natively
  supported by viem.
- **Alternatives considered**: `personal_sign` over a packed string (rejected: weaker domain
  binding, ambiguous encoding); raw `eth_sign` (rejected: unsafe/blind signing).

## 8. Link / key transport

- **Decision**: The private key travels in the **URL fragment** as a **base64url-encoded** 32-byte
  secp256k1 key (e.g., `…/#k=<base64url>`), decoded and parsed entirely client-side. It is held in
  memory only, never written to storage, logs, analytics, or any network request other than the
  signed output it produces.
- **Rationale**: URL fragments are not sent to servers, satisfying "key never leaves the device"
  (Principle II/III). Contract for the exact format is in `contracts/claim-link.md`.
- **Alternatives considered**: Query string (rejected: sent to server, may be logged); path segment
  (rejected: same exposure); requiring paste of a code (rejected: worse UX, no benefit here).

## 9. Testing strategy

- **Decision**: Vitest unit tests for normalization, address validation, EIP-712 signing, and
  calldata encoding; Vitest integration tests against a local **Anvil** node with a **mock
  registrar** (and, where feasible, a local bundler such as Pimlico `alto`) to exercise reads
  (whitelist/availability) and a sponsored `register`; Playwright E2E for the full claim flow and
  every error state, with `@axe-core/playwright` asserting WCAG 2.2 AA and a manual keyboard/
  screen-reader pass for the primary flow.
- **Rationale**: Satisfies Principle V and the spec's success criteria (SC-003, SC-006, SC-007).
  Splitting pure logic (unit) from chain interaction (integration) keeps fast feedback and isolates
  AA-stack flakiness.
- **Alternatives considered**: Only testnet E2E (rejected: slow, flaky, costs faucet funds); mocking
  all chain calls (rejected: misses calldata/signature correctness against a real EVM).

## Resolved deferrals

| Spec deferral | Resolution |
|---------------|------------|
| Chain/network selection | Chain-agnostic via config; recommended EVM L2; Anvil/testnet for dev/test (§5). |
| Performance/throughput targets | Low concurrency; targets captured in plan Technical Context (claim < 2 min, interactions < 100 ms). |

No `NEEDS CLARIFICATION` markers remain.
