---
description: "Task list for One-Time ENS Name Registration"
---

# Tasks: One-Time ENS Name Registration

**Input**: Design documents from `specs/001-ens-name-registration/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: INCLUDED — the project constitution (Principle V: Verifiable Quality) and spec success
criteria SC-003/SC-006/SC-007 require automated tests. Test tasks are written before their
implementation and must FAIL first.

**Organization**: Tasks are grouped by user story (US1=P1, US2=P2, US3=P3) for independent delivery.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: US1 / US2 / US3 (omitted for Setup, Foundational, Polish)
- Exact file paths are included in each task

## Path Conventions

Single frontend-only SvelteKit project (scaffolded by `pnpx sv create`); code under `src/`, tests
under `tests/`, at repository root (per plan.md Structure Decision).

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and tooling

- [X] T001 Scaffold the app with `pnpx sv create .` (TypeScript template; add-ons: eslint, vitest, playwright, sveltekit-adapter — no prettier) using **pnpm**, then `pnpm install`
- [X] T002 [P] Add runtime dependencies: `pnpm add viem permissionless @adraffy/ens-normalize`
- [X] T003 [P] Add dev dependency `@axe-core/playwright` and configure it in `playwright.config.ts`
- [X] T004 [P] Configure static output: set `@sveltejs/adapter-static` and prerender in `svelte.config.js` and `src/routes/+layout.ts`
- [X] T005 [P] Add public config: `.env.example` with all `PUBLIC_*` keys from `contracts/registrar-interface.md` and `contracts/erc4337-integration.md`, and a typed loader in `src/lib/chain/config.ts`
- [X] T006 [P] Add scripts to `package.json`: `test:unit` (vitest), `test:integration` (vitest, anvil), `test:e2e` (playwright), `lint`, `check` (typecheck)
- [X] T007 [P] Set up the integration harness in `tests/integration/setup.ts`: start Anvil, deploy a mock registrar, and whitelist a known test signer (per `contracts/registrar-interface.md`)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Reusable building blocks every story composes. **No user story may begin until done.**

- [X] T008 [P] Implement the viem public client (from config) in `src/lib/chain/client.ts`
- [X] T009 [P] Implement claim-link parsing (base64url-decode `k` → 32-byte secp256k1 key → derive `signerAddress`; reject malformed) in `src/lib/claim/link.ts` per `contracts/claim-link.md`
- [ ] T009a Confirm the deployed registrar's ABI, `Registered` event, and EIP-712 domain (name/version/chainId/verifyingContract) with the contract owner; reconcile `contracts/registrar-interface.md` and fail the phase if unavailable
- [X] T010 [P] Define the registrar ABI and typed bindings in `src/lib/registrar/abi.ts` per `contracts/registrar-interface.md`
- [X] T011 [P] Implement the EIP-712 `Registration` typed-data builder in `src/lib/registrar/typedData.ts` (domain bound to registrar address + chainId)
- [X] T012 [P] Implement ENSIP-15 label normalization + fully-qualified-name assembly in `src/lib/ens/normalize.ts`
- [X] T013 [P] Implement EVM address validation in `src/lib/ens/address.ts`
- [X] T014 [P] Implement the ERC-4337 account/bundler/Paymaster client (permissionless): build counterfactual **Safe** smart account owned by the embedded key, plus send/wait UserOp helpers, in `src/lib/aa/account.ts` per `contracts/erc4337-integration.md`
- [X] T015 Implement the claim session state machine + error categories (runes store) in `src/lib/claim/session.svelte.ts` per `data-model.md`
- [X] T016 Implement the base accessible shell: `src/routes/+layout.svelte`, `src/routes/+page.svelte` (reads URL fragment client-side, clears it via `replaceState`), an `aria-live` status region in `src/lib/components/StatusBanner.svelte`, and a focus-management util in `src/lib/a11y/focus.ts`

**Checkpoint**: Foundation ready — user stories can now proceed.

---

## Phase 3: User Story 1 - Claim a name with a one-time link (Priority: P1) 🎯 MVP

**Goal**: A valid, unused link lets the claimant pick an available label + target address and register
it gaslessly, ending on a success confirmation with the fully-qualified name.

**Independent Test**: Open a valid unused link, enter a free name + well-formed address, submit;
registration completes on-chain with no gas paid and the success card shows the FQ name.

### Tests for User Story 1 (write first, must FAIL) ⚠️

- [X] T017 [P] [US1] Unit test EIP-712 signing of `{label,target}` + `register` calldata encoding in `tests/unit/sign.spec.ts`
- [X] T018 [P] [US1] Integration test: sponsored `register` succeeds and emits `Registered` against Anvil + mock registrar in `tests/integration/register.spec.ts`
- [ ] T019 [P] [US1] E2E test: valid link → enter label+address → submit → success card, zero gas; axe AA on each state in `tests/e2e/claim.spec.ts`

### Implementation for User Story 1

- [X] T020 [P] [US1] Implement registrar read `available(label)` in `src/lib/registrar/reads.ts`
- [X] T021 [P] [US1] Implement `(label,target)` signing with the embedded key (viem account) in `src/lib/registrar/sign.ts` (uses T011)
- [X] T022 [US1] Implement the register flow: build calldata → send Paymaster-sponsored UserOp → wait receipt → read `Registered`, in `src/lib/claim/register.ts` (uses T014, T020, T021)
- [X] T023 [P] [US1] Build the accessible `ClaimForm` (label + address inputs, labels, submit) in `src/lib/components/ClaimForm.svelte`
- [X] T024 [P] [US1] Build the `SuccessCard` (FQ name + associated address) in `src/lib/components/SuccessCard.svelte`
- [X] T025 [US1] Wire the happy-path state flow in `src/routes/+page.svelte` and `src/lib/claim/session.svelte.ts`: LoadingLink → Ready → Signing → Submitting → Pending → Success, with focus + `aria-live` updates

**Checkpoint**: MVP — a valid link can register a name gaslessly, independently testable.

---

## Phase 4: User Story 2 - Prevent reuse and unauthorized claims (Priority: P2)

**Goal**: Each invitation is redeemable at most once and only by a whitelisted link; non-whitelisted,
already-redeemed, and post-success-reopen cases are detected and clearly distinguished.

**Independent Test**: Attempt claims with a non-whitelisted link and an already-redeemed link; both
are rejected with distinct messages and no registration; reopening a redeemed link shows redeemed.

### Tests for User Story 2 (write first, must FAIL) ⚠️

- [X] T026 [P] [US2] Integration test: second `register` with the same key reverts (single use); a non-whitelisted signer reverts, in `tests/integration/whitelist.spec.ts`
- [X] T027 [P] [US2] E2E test: non-whitelisted → `NotAuthorized`; redeemed → `AlreadyRedeemed`; reopen after success → `AlreadyRedeemed`, in `tests/e2e/reuse.spec.ts`

### Implementation for User Story 2

- [X] T028 [P] [US2] Implement registrar read `whitelist(account) → (authorized, used)` in `src/lib/registrar/reads.ts`
- [X] T029 [US2] Add the `CheckingWhitelist` transition resolving to `Ready` / `NotAuthorized` / `AlreadyRedeemed` in `src/lib/claim/session.svelte.ts` (uses T028)
- [X] T030 [P] [US2] Build the `LinkState` component for `InvalidLink` / `NotAuthorized` / `AlreadyRedeemed` messaging in `src/lib/components/LinkState.svelte`
- [X] T031 [US2] Handle post-success reopen → `AlreadyRedeemed` (re-derive state from chain on load) in `src/routes/+page.svelte`

**Checkpoint**: US1 + US2 both work; reuse and unauthorized links are blocked distinctly.

---

## Phase 5: User Story 3 - Clear validation and error recovery (Priority: P3)

**Goal**: Immediate, distinct, actionable feedback for malformed/taken names, malformed addresses,
and submission/sponsorship failures, with safe retry.

**Independent Test**: Enter an invalid name, an already-taken name, and a malformed address, and force
a submission failure; each yields a distinct message and the claimant can recover without losing the link.

### Tests for User Story 3 (write first, must FAIL) ⚠️

- [X] T032 [P] [US3] Unit test ENSIP-15 accept/reject + normalized-preview and address validation in `tests/unit/validation.spec.ts`
- [X] T033 [P] [US3] E2E test: invalid label inline error; malformed address; name-taken; sponsorship/submission failure + retry; axe AA, in `tests/e2e/validation.spec.ts`

### Implementation for User Story 3

- [X] T034 [US3] Add live inline validation to `src/lib/components/ClaimForm.svelte`: show normalized label preview, block submit on invalid label/address with `aria` error messaging (uses T012, T013)
- [X] T035 [US3] Map name-availability loss to `NameTaken` (pre-check + revert mapping) in `src/lib/claim/register.ts`
- [X] T036 [P] [US3] Build the `ErrorAlert` component and map `SponsorshipFailed` / `SubmissionFailed` to actionable messages in `src/lib/components/ErrorAlert.svelte`
- [X] T037 [US3] Add `Pending` UX (disable resubmission) and `Failed → Ready` safe-retry transition in `src/routes/+page.svelte` and `src/lib/claim/session.svelte.ts`

**Checkpoint**: All stories independently functional; every error state is distinct and recoverable.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Hardening and validation across all stories

- [X] T038 [P] Privacy guard: assert the key/signature are excluded from all logs/error payloads and the fragment is cleared via `replaceState`; add a guard test in `tests/unit/privacy.spec.ts` (SC-005, FR-010)
- [ ] T039 [P] Accessibility sweep: manual keyboard + screen-reader pass across every state and managed focus; finalize axe config (FR-011, SC-006)
- [X] T040 [P] CI pipeline: run `lint`, `check` (typecheck), `test:unit`, `test:integration`, `test:e2e`, and `pnpm audit` as gates (Principle V)
- [X] T041 [P] Docs: `README.md` covering `PUBLIC_*` config, static build (`pnpm build`), and deployment
- [ ] T042 Run the full `quickstart.md` validation end-to-end (all scenarios pass)
- [ ] T043 Verify performance targets: claim < 2 min, interactions feel instant, mobile bundle reasonable (SC-001)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately.
- **Foundational (Phase 2)**: Depends on Setup — BLOCKS all user stories.
- **T009a (registrar verification)** BLOCKS T010, T011, T022.
- **User Stories (Phase 3–5)**: All depend on Foundational; then independently testable. Priority order P1 → P2 → P3, or parallel if staffed.
- **Polish (Phase 6)**: Depends on the targeted user stories being complete.

### User Story Dependencies

- **US1 (P1)**: After Foundational. No dependency on other stories. = MVP.
- **US2 (P2)**: After Foundational. Adds whitelist/reuse gating to the same page; independently testable. Reuses `src/lib/registrar/reads.ts` (extends T020's file — sequence T028 after T020 if same file).
- **US3 (P3)**: After Foundational. Extends `ClaimForm`/`register`/`session` (sequence after US1 tasks that touch those files).

### Within Each User Story

- Tests first (must FAIL) → libs/reads → flow/services → components → page wiring.
- Files shared across tasks are sequenced (no `[P]`); distinct files run parallel.

### Parallel Opportunities

- Setup: T002–T007 in parallel after T001.
- Foundational: T008–T014 in parallel (distinct files); T015 then T016 follow.
- US1 tests T017–T019 in parallel; then T020/T021/T023/T024 in parallel, T022 then T025 sequenced.
- US2 tests T026–T027 parallel; US3 tests T032–T033 parallel.
- Polish T038–T041 in parallel.

---

## Parallel Example: User Story 1

```bash
# Tests for US1 together (write first, expect FAIL):
Task: "Unit test signing + calldata in tests/unit/sign.spec.ts"
Task: "Integration test sponsored register in tests/integration/register.spec.ts"
Task: "E2E test claim happy path + axe in tests/e2e/claim.spec.ts"

# Then parallel implementation (distinct files):
Task: "available(label) read in src/lib/registrar/reads.ts"
Task: "sign (label,target) in src/lib/registrar/sign.ts"
Task: "ClaimForm in src/lib/components/ClaimForm.svelte"
Task: "SuccessCard in src/lib/components/SuccessCard.svelte"
```

---

## Implementation Strategy

### MVP First (User Story 1 only)

1. Phase 1 Setup → 2. Phase 2 Foundational (CRITICAL) → 3. Phase 3 US1 → **STOP & VALIDATE** US1 independently → demo gasless claim.

### Incremental Delivery

1. Setup + Foundational → foundation ready.
2. US1 → test → demo (MVP).
3. US2 → test → demo (reuse/auth hardening).
4. US3 → test → demo (validation/recovery).
5. Polish → ship.

### Parallel Team Strategy

After Foundational: Dev A → US1, Dev B → US2, Dev C → US3, coordinating on shared files
(`reads.ts`, `session.svelte.ts`, `+page.svelte`, `ClaimForm.svelte`).

---

## Notes

- [P] = different files, no incomplete dependencies.
- Tests are included per the constitution (Principle V); verify they FAIL before implementing.
- The embedded key and signature MUST never be logged, stored, or sent anywhere (FR-010, SC-005).
- Commit after each task or logical group; stop at any checkpoint to validate a story independently.
