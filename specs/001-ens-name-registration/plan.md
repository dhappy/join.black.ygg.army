# Implementation Plan: One-Time ENS Name Registration

**Branch**: `001-ens-name-registration` (git branch: `master`) | **Date**: 2026-06-19 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/001-ens-name-registration/spec.md`

## Summary

A claimant opens a secure, single-use link that carries an ECDSA private key in the URL fragment.
The app (a static Svelte + TypeScript SPA) derives the key's address, lets the claimant choose an
ENS-normalized label under a fixed postfix plus a target address, signs the `(name, address)` pair
with the embedded key, and submits a `register` call to a project-controlled registrar contract.
The transaction is delivered gaslessly via ERC-4337: the embedded key owns a counterfactual smart
account that sends a Paymaster-sponsored UserOperation, so the claimant pays nothing. The registrar
recovers the signer from the calldata signature, checks it against an on-chain whitelist, enforces
single use, verifies name availability, and registers the name. No backend is involved and the key
never leaves the device.

## Technical Context

**Language/Version**: TypeScript ~5.6, Svelte 5 (runes) on SvelteKit ~2.x

**Scaffolding / Tooling**: Project generated with **`pnpx sv create`** (the `sv` CLI) with the
TypeScript template and the `eslint`, `vitest`, `playwright`, and `sveltekit-adapter` (static)
add-ons (no prettier, per project preference). **pnpm** is the package manager; all scripts run via
`pnpm` / `pnpx`.

**Primary Dependencies** (added after scaffolding):
- `viem` ~2.x — Ethereum reads/writes, key handling, EIP-712 signing, ENS normalization
- `@account-kit/smart-contracts` + `@account-kit/infra` + `@aa-sdk/core` (Alchemy Account Kit, Modular Account v2) — gasless via an Alchemy Gas Manager sponsorship policy (`policyId`)
- `@adraffy/ens-normalize` (ENSIP-15) — used directly or via `viem/ens` `normalize`
- `@sveltejs/adapter-static` — added via the `sv` adapter add-on (static build, no server runtime)

**Storage**: None. All claim state is in-memory (ephemeral); the embedded key lives only in the URL
fragment and component state. No database, no persistence, no cookies.

**Testing**: Vitest (unit) and Playwright + `@axe-core/playwright` (E2E flow + WCAG 2.2 AA checks)
— both provisioned by `sv create` add-ons. Integration tests run Vitest against a local Anvil
(Foundry) node with a mock registrar.

**Target Platform**: Evergreen desktop + mobile browsers; deployed as static files over HTTPS
(e.g., to `public_html`). No server-side rendering of dynamic data.

**Project Type**: Web — frontend-only single-page (static) application

**Performance Goals**: Claim completes end-to-end in < 2 min (SC-001); form/validation interactions
feel instant (< 100 ms perceived); first meaningful paint quick on mobile networks.

**Constraints**: Key never transmitted to or logged by any server (URL fragment only); zero gas /
zero wallet funding for the claimant (Paymaster-sponsored); WCAG 2.2 AA; no backend; no third-party
trackers; secrets/config provided via build-time public configuration only (no private keys, no
secret API keys shipped to the client); gas sponsorship MUST use an on-chain-scoped verifying
Paymaster (no client-held Paymaster secret).

**Scale/Scope**: Low concurrency (one-time individual claims); ~4 UI states/screens (link
validation, claim form, pending, success/error). Not a high-throughput system.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Evaluated against `.specify/memory/constitution.md` v1.0.0.

| Principle | Assessment | How the plan complies |
|-----------|-----------|------------------------|
| **I. Accessible & Inclusive UX (NON-NEGOTIABLE)** | PASS | Semantic HTML via Svelte; full keyboard operability with managed focus on each state transition; programmatic labels/`aria-live` for status and errors; AA contrast; responsive layout; automated `axe` checks + manual keyboard/screen-reader pass in E2E. |
| **II. Privacy by Design & Data Minimization** | PASS | Only the chosen label + target address are collected. Key stays in the URL fragment (never sent to a server), held in memory only. No backend, no trackers, no persistence/retention. |
| **III. Secure Authentication & Onboarding** | PASS | Served over HTTPS. No secrets in source or client bundle (only public chain/contract/endpoint config). Key and signature never logged or placed in error reports. Authorization is an EIP-712 signature bound to the registrar address + chainId (anti-replay); single-use enforced on-chain. Brute force/credential stuffing N/A (no server auth surface). |
| **IV. Simplicity & Minimal Dependencies** | PASS | Three runtime libraries, each justified; the AA path uses the viem-native `permissionless` with an audited smart-account implementation. No backend, no state store beyond in-memory runes. |
| **V. Verifiable Quality** | PASS | Vitest unit tests for normalization/validation/signing/calldata; integration tests against Anvil + a mock registrar; Playwright E2E covering the happy path and every error state, with `axe` a11y assertions; CI gates: lint, typecheck, test, dependency audit. |

**Result**: PASS — no violations. Complexity Tracking section left empty (no justified deviations).

## Project Structure

### Documentation (this feature)

```text
specs/001-ens-name-registration/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
├── contracts/           # Phase 1 output (/speckit-plan command)
│   ├── registrar-interface.md
│   ├── claim-link.md
│   └── erc4337-integration.md
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

The base project (config files, `src/`, `tests/`, `src/app.html`, `svelte.config.js`,
`vite.config.ts`, lint/format/test configs) is **generated by `pnpx sv create`**. Feature code is
then added under `src/lib/`, and feature tests under the `sv`-provisioned test locations:

```text
src/
├── lib/                # feature code added on top of the sv-create scaffold
│   ├── chain/          # viem public/wallet clients, chain + RPC config
│   ├── aa/             # ERC-4337: smart account (owned by embedded key), bundler + Paymaster clients, UserOp send/wait
│   ├── registrar/      # registrar ABI, read calls (whitelist status, name availability), register calldata, EIP-712 typed data
│   ├── ens/            # ENSIP-15 normalization + label validation, fully-qualified name assembly
│   ├── claim/          # claim session state machine (Svelte runes store)
│   └── components/     # accessible UI: ClaimForm, StatusBanner, LinkState, SuccessCard, ErrorAlert
├── routes/
│   ├── +layout.svelte
│   └── +page.svelte    # single claim page; reads key from URL fragment client-side
└── app.html            # (from scaffold)

tests/                  # vitest unit/integration + playwright e2e (a11y via axe)
static/                 # static assets (from scaffold)
svelte.config.js        # sv-create scaffold; adapter-static add-on
vite.config.ts          # from scaffold
```

**Structure Decision**: Single frontend-only SvelteKit project scaffolded by `pnpx sv create` and
built to static files (`adapter-static`). The blockchain/AA concerns are isolated in
`src/lib/{chain,aa,registrar,ens}` so they are unit-testable in isolation and swappable by config
(chain, contract address, bundler and Paymaster endpoints). The claim flow is a single page driven
by an explicit state machine in `src/lib/claim`, keeping UI and on-chain logic decoupled and
accessible-by-construction.

## Complexity Tracking

> No constitutional violations — no entries required.
