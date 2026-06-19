# join.black.ygg.army

A static Svelte + TypeScript app for **one-time ENS name registration**. A claimant opens a
secure, single-use link carrying an ECDSA key in the URL fragment, picks an ENSIP-15–normalized
label under a fixed postfix plus a target address, signs the `(label, target)` pair with the
embedded key, and registers it gaslessly via an ERC-4337 Paymaster-sponsored UserOperation. The
registrar contract recovers the signer from the signature, checks an on-chain whitelist, enforces
single use, and registers the name. No backend; the key never leaves the device.

See [`specs/001-ens-name-registration/`](specs/001-ens-name-registration/) for the full spec,
plan, and contracts.

## Prerequisites

- Node.js (LTS) and **pnpm**
- For integration tests: **Foundry** (`anvil`) + a deployed/mock registrar
- For end-to-end: an ERC-4337 bundler + Paymaster and a deployed registrar

## Configuration

All configuration is **public, build-time** (`PUBLIC_*`) and shipped to the client — never put
private keys or secret API keys here. Copy `.env.example` to `.env` and fill in:

| Key | Meaning |
|-----|---------|
| `PUBLIC_CHAIN_ID` | Target chain id |
| `PUBLIC_RPC_URL` | Read RPC endpoint |
| `PUBLIC_REGISTRAR_ADDRESS` | Registrar contract address |
| `PUBLIC_POSTFIX` | Fixed parent name (e.g. `black.ygg.army`) |
| `PUBLIC_REGISTRAR_NAME` / `PUBLIC_REGISTRAR_VERSION` | EIP-712 domain values |
| `PUBLIC_ENTRYPOINT_ADDRESS` | ERC-4337 EntryPoint |
| `PUBLIC_BUNDLER_URL` | Bundler RPC endpoint |
| `PUBLIC_PAYMASTER_URL` | On-chain-scoped verifying Paymaster endpoint |

The build itself does not require these (the shell prerenders without them); they are read in the
browser when a claim is processed.

## Develop

```sh
pnpm install
pnpm dev            # dev server
pnpm build          # static production build (adapter-static, output in build/)
pnpm preview        # serve the static build
```

## Verify

```sh
pnpm lint           # eslint
pnpm check          # svelte-check / typecheck
pnpm test:ci        # unit tests (node project) — pure logic: link, normalize, address, signing, state
pnpm test:e2e       # Playwright E2E (requires deployed infra + PUBLIC_* config)
pnpm audit --prod --audit-level high
```

CI (`.github/workflows/ci.yml`) runs lint, check, unit tests, build, and the audit on every push
and PR. The E2E job is opt-in (repo variable `RUN_E2E=true` plus the `PUBLIC_*` config) since it
needs the deployed registrar/Paymaster/bundler.

## Deployment

`pnpm build` emits a fully static site to `build/`. Deploy those files to any static host over
HTTPS (e.g. copy into `public_html/`). No server runtime is required.

## Security notes

- The claim key travels only in the URL **fragment**, is decoded client-side, is held in memory
  only, and is cleared from the address bar on load. It is never sent to a server.
- Gas sponsorship must use an **on-chain-scoped verifying Paymaster** so the static client holds no
  secret (see `specs/.../contracts/erc4337-integration.md`).
- **Risk-accepted advisory:** `GHSA-96hv-2xvq-fx4p` (`ws` server DoS, transitive via
  `viem → isows → ws`) is ignored in `pnpm.auditConfig.ignoreGhsas`. The app uses viem's HTTP
  transport only and runs no WebSocket server, so the vulnerable path is unreachable.

## Status

Implemented and statically verified: project setup, claim-link parsing, ENSIP-15 normalization,
address validation, registrar ABI + EIP-712 signing, the gasless register flow (Safe smart account
+ bundler/Paymaster), and the accessible claim UI. **Pending** the deployed registrar/Paymaster/
chain (and registrar ABI confirmation, T009a): the integration and end-to-end test suites and
runtime validation of the on-chain flow.
