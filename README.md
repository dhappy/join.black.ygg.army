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

Gas sponsorship uses **Biconomy MEE testnet sponsorship** (`@biconomy/abstractjs`) — it works out of
the box on testnets with no bundler/Paymaster URLs, EntryPoint address, or dashboard setup, so there
are no related config keys.

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

### Registrar contract (test mock)

Deploy the test `MockRegistrar` with the helper script. It defaults to **Base Sepolia** (where
Biconomy's testnet gas tank lives, so MEE testnet sponsorship works). Import a funded deployer
keystore first:

```sh
cast wallet import deployer --interactive
ACCOUNT=deployer ./test-contracts/deploy.sh <signer-address-to-whitelist> ...
```

Pick a network with `NETWORK=` (`base-sepolia` | `base` | `mainnet` | `sepolia` | `optimism` |
`op-sepolia` | `arbitrum`), or override `RPC_URL` / `EXPLORER_URL`. Mainnets require an explicit
`CONFIRM_MAINNET=yes` (and note: Biconomy *testnet* sponsorship does not apply on mainnet — a
production MEE gas tank is needed there):

```sh
NETWORK=mainnet CONFIRM_MAINNET=yes ACCOUNT=deployer ./test-contracts/deploy.sh
```

It deploys, whitelists any addresses you pass, and prints the `PUBLIC_*` values to set. The mock is
test-only (open `allow()`, no real name resolution) — not for production.

**Production ENS registrar.** `REGISTRAR_KIND=ens` deploys `EnsSubnameRegistrar` instead, which
registers **real ENS subnames** under a DNSSEC-imported parent (legacy ENS registry path: the
registrar keeps node ownership and sets the `addr` record to the claimant's address). It needs the
network's Public Resolver, and the deployed contract must be made the **owner of the parent node**
in ENS before it can register. The app-facing interface is identical, so nothing changes client-side.
Test on Sepolia and audit before mainnet:

```sh
REGISTRAR_KIND=ens ENS_RESOLVER=<public-resolver-address> POSTFIX=black.ygg.army \
  NETWORK=sepolia ACCOUNT=deployer ./test-contracts/deploy.sh
```

To whitelist an address later (allow one registration for that signer) on an already-deployed
registrar:

```sh
cast send <REGISTRAR_ADDRESS> "allow(address)" <SIGNER_ADDRESS> \
  --rpc-url https://sepolia.base.org --account deployer
```

Generate a claim link (and the signer address to whitelist) with
`node scripts/make-claim-link.mjs`.

## Security notes

- The claim key travels only in the URL **fragment**, is decoded client-side, is held in memory
  only, and is cleared from the address bar on load. It is never sent to a server.
- Gas sponsorship uses **Biconomy MEE testnet sponsorship**; the static client holds no secret (the
  testnet API key is a public shared value baked at build time — see `src/lib/aa/account.ts`).
- **Risk-accepted advisory:** `GHSA-96hv-2xvq-fx4p` (`ws` server DoS, transitive via
  `viem → isows → ws`) is ignored in `pnpm.auditConfig.ignoreGhsas`. The app uses viem's HTTP
  transport only and runs no WebSocket server, so the vulnerable path is unreachable.

## Status

Implemented and statically verified: project setup, claim-link parsing, ENSIP-15 normalization,
address validation, registrar ABI + EIP-712 signing, the gasless register flow (Safe smart account
+ bundler/Paymaster), and the accessible claim UI. **Pending** the deployed registrar/Paymaster/
chain (and registrar ABI confirmation, T009a): the integration and end-to-end test suites and
runtime validation of the on-chain flow.
