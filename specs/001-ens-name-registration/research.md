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

- **Decision**: **Biconomy MEE** via `@biconomy/abstractjs`. The embedded key signs a **Nexus** smart
  account (`toMultichainNexusAccount`); the claim is submitted as a single sponsored **MEE
  supertransaction** (`meeClient.execute`) whose instruction calls
  `registrar.register(label, target, signature)`, then awaited with `waitForSupertransactionReceipt`.
- **Rationale**: The clarified model (registrar recovers the `(name, address)` signer from calldata;
  AA is only the gasless transport) means the *sender* identity is irrelevant to authorization — so
  the simplest sender is a Nexus account owned by the same embedded key, requiring the claimant to
  hold exactly one secret. Biconomy MEE supplies the bundler + gas sponsorship and the SDK handles
  account deployment, execution, and receipt waiting.
- **Alternatives considered**: viem bundler + `permissionless` Safe account with a self-hosted
  verifying Paymaster (rejected: requires standing up and funding our own bundler + Paymaster;
  Biconomy testnet sponsorship is out-of-the-box); registrar trusting `msg.sender` (rejected in
  clarify Q3); a project-run relayer/meta-tx backend (rejected: adds a backend); EOA + user pays gas
  (rejected by clarify Q1 — must be gasless).

## 4. Gas sponsorship model (Biconomy MEE testnet sponsorship)

- **Decision**: Use **Biconomy MEE testnet sponsorship** — `createMeeClient` with
  `getDefaultMEENetworkUrl(true)` / `getDefaultMEENetworkApiKey(true)`, and
  `execute({ sponsorship: true, sponsorshipOptions: { url, gasTank: getDefaultMeeGasTank(true) } })`.
  Gas is covered by Biconomy's shared testnet gas tank (on Base Sepolia, chain 84532); no dashboard,
  no bundler/Paymaster URLs, and no client-held *secret* (the testnet API key is a public shared
  value baked at build time).
- **Rationale**: Keeps the client static and backend-free (Principle II/III) while removing the need
  to operate and fund our own bundler + verifying Paymaster. Production switches to a configured MEE
  node URL + API key + a project gas tank (Biconomy dashboard) — a config change, not a code change.
- **Alternatives considered**: self-hosted ERC-4337 bundler + on-chain-scoped verifying Paymaster
  (rejected: infra to run and fund; more moving parts than testnet sponsorship); embedding a secret
  Paymaster API key in the bundle (rejected: secret leakage); a backend relayer (rejected: no-backend).

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
