# Feature Specification: One-Time ENS Name Registration

**Feature Branch**: `001-ens-name-registration`

**Created**: 2026-06-19

**Status**: Draft

**Input**: User description: "A user will be securely passed a URL meant to allow the one-time registration of an ENS name under the control of a particular postfix. The URL will contain an ECDSA key whose public address has been added to a whitelist stored in a smart contract. The claimant enters the name & address they want to associate. The provided key is used to sign the pair & they, along with the signature, are submitted to the contract. The contract will derive the public address, verify that it hasn't been used yet, & then register the name. This should be a Svelte TypeScript app."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Claim a name with a one-time link (Priority: P1)

A person receives a secure, single-use link out-of-band. Opening it presents a simple form
where they enter the name they want (the label that will sit under a fixed postfix, e.g.
`alice` → `alice.<postfix>`) and the address that name should be associated with. They confirm,
and the name is registered to them on-chain without their needing a funded wallet or paying any
gas. They see a confirmation showing their fully-qualified name and the associated address.

**Why this priority**: This is the entire purpose of the feature — converting an authorized
invitation into a registered name. Without it there is no product.

**Independent Test**: Open a valid, unused claim link, enter a free name and a well-formed
address, submit, and confirm an on-chain registration completes and is reflected in the
confirmation — with no gas paid by the claimant.

**Acceptance Scenarios**:

1. **Given** a valid, unused claim link, **When** the claimant enters an available name and a
   well-formed address and submits, **Then** the name is registered under the postfix, mapped to
   the address, and a success confirmation shows the fully-qualified name.
2. **Given** a valid claim link, **When** the claimant submits, **Then** the claimant pays no gas
   and is not required to connect or fund a wallet.
3. **Given** a successful registration, **When** the confirmation is shown, **Then** it displays
   the fully-qualified name (label + postfix) and the associated address.

---

### User Story 2 - Prevent reuse and unauthorized claims (Priority: P2)

The system ensures each invitation can be redeemed at most once and only by an authorized link.
A link whose key is not on the whitelist, or whose whitelist entry has already been consumed,
cannot be used to register a name.

**Why this priority**: The one-time, whitelist-gated guarantee is the core trust property of the
feature; if links could be reused or forged, the namespace integrity is compromised.

**Independent Test**: Attempt to claim with (a) a link not on the whitelist and (b) a link that
has already been successfully redeemed; verify both are rejected with distinct, clear messages
and no registration occurs.

**Acceptance Scenarios**:

1. **Given** a link whose key is not on the whitelist, **When** the claimant submits, **Then** the
   attempt is rejected and the claimant is told the link is not authorized.
2. **Given** a link whose whitelist entry has already been used, **When** the claimant opens or
   submits it, **Then** they are told the link has already been redeemed and no new registration
   is attempted.
3. **Given** a successful claim, **When** the same link is reopened later, **Then** the app shows
   the already-redeemed state rather than offering a fresh claim.

---

### User Story 3 - Clear validation and error recovery (Priority: P3)

Throughout the flow the claimant receives immediate, understandable feedback: when the entered
name is malformed or already taken, when the address is malformed, and when on-chain submission
fails. They can correct input and retry safely.

**Why this priority**: A smooth, accessible, low-friction experience is essential for non-expert
claimants and is required by the project constitution; it materially affects completion rates but
is not part of the minimal happy path.

**Independent Test**: Enter an invalid name, an already-taken name, and a malformed address in
turn, and force a submission failure; verify each produces a distinct, actionable message and the
claimant can recover without losing their link.

**Acceptance Scenarios**:

1. **Given** the claim form, **When** the claimant enters a name that violates the allowed format
   for the postfix, **Then** they see an inline explanation before submission is allowed.
2. **Given** a name already registered under the postfix, **When** the claimant submits, **Then**
   they are told the name is taken and prompted to choose another.
3. **Given** a transient on-chain or sponsorship failure, **When** submission fails, **Then** the
   claimant sees an actionable message and can retry without re-opening the link.

---

### Edge Cases

- Claim link is tampered with, truncated, or carries a malformed key → treated as an invalid link
  with a clear message; no submission attempted.
- Whitelist entry exists but has already been consumed → "already redeemed" state.
- Desired name is already registered under the postfix → rejected before or at submission with a
  "name taken" message.
- Associated address is malformed or empty → blocked with inline validation.
- Two claimants attempt the same name concurrently → at most one registration succeeds; the loser
  receives a "name taken" message and may choose another.
- Gas sponsorship is unavailable or declined (e.g., sponsor funds exhausted) → claimant sees an
  actionable failure message; no partial registration.
- Network congestion or a long-pending submission → claimant sees clear pending state and is not
  led to submit twice.
- Claimant refreshes or reopens the page mid-flow → the link/key is preserved and no duplicate
  registration is created.
- Browser lacks capabilities required to complete the claim → claimant is informed rather than
  failing silently.

## Clarifications

### Session 2026-06-19

- Q: Which gas-sponsorship standard does the "Paymaster" refer to? → A: ERC-4337 account-abstraction Paymaster (the earlier "ERC-4773" was a typo for ERC-4337); claimant submits a sponsored UserOperation.
- Q: What namespace/registry does a claimed name register into? → A: A project-controlled registrar smart contract that issues subnames under one fixed postfix (not canonical `.eth` ENS); the whitelist, single-use check, and registration all live in that contract.
- Q: How is authorization checked vs. how is the call submitted? → A: The registrar recovers the signer's address from the `(name, address)` signature passed in calldata and checks it against the whitelist; ERC-4337 + Paymaster is only the gasless transport, so any sponsored sender may submit and the embedded key only signs (it need not be the on-chain sender).
- Q: What rules make an entered name valid under the postfix? → A: Apply standard ENS name normalization (ENSIP-15 / `ens-normalize`); accept only labels that normalize to valid ENS labels and reject the rest with guidance.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST read the one-time authorization key embedded in the claim link entirely
  on the claimant's device, without transmitting the key to any server.
- **FR-002**: System MUST let the claimant enter a desired name (the label placed under the fixed
  postfix) and a target address to associate with it.
- **FR-003**: System MUST validate the entered name by applying ENS name normalization
  (ENSIP-15): only labels that normalize to a valid ENS label are accepted, and the claimant is
  shown the normalized form before submission; non-normalizable labels MUST be rejected with
  guidance. System MUST also validate the address for well-formedness before allowing submission.
- **FR-004**: System MUST produce a cryptographic signature over the (name, address) pair using
  the embedded key, computed on the claimant's device.
- **FR-005**: System MUST submit the name, address, and signature for on-chain registration in a
  way that requires the claimant to pay no gas and to fund no wallet (gas is sponsored).
- **FR-006**: Registration MUST succeed only when the public address the registrar recovers from
  the submitted `(name, address)` signature is present on the contract whitelist and that whitelist
  entry has not previously been used. Authorization MUST depend on the recovered signer, not on the
  identity of the account that submits the transaction.
- **FR-007**: On success, System MUST show a confirmation that includes the fully-qualified name
  (label + postfix) and the associated address.
- **FR-007a**: Registration MUST create the subname under the postfix and set its forward-resolution
  target to the claimant-provided address. Registry control of the subname remains with the
  postfix/registrar; the claimant does not receive transferable ownership of the node (post-
  registration management is out of scope).
- **FR-008**: System MUST distinguish and clearly communicate the cases of: invalid/malformed
  link, link not on the whitelist, and link already redeemed.
- **FR-009**: System MUST detect and disclose when the desired name is already registered under
  the postfix and allow the claimant to choose a different name.
- **FR-010**: System MUST NOT persist or transmit the embedded key beyond what is needed on-device
  to sign within the active session.
- **FR-011**: All claimant-facing screens MUST meet the accessibility requirements of the project
  constitution (keyboard operability, programmatic labels, screen-reader support, AA contrast).
- **FR-012**: System MUST handle submission failures (on-chain revert, sponsorship failure,
  network errors) with actionable messaging and allow a safe retry where appropriate.
- **FR-013**: System MUST behave safely on refresh or reopen — after a successful claim it MUST
  show the already-redeemed state and never imply a second registration is possible.
- **FR-014**: System MUST collect no personal data beyond the name and address the claimant
  chooses to register (data minimization per constitution).

### Key Entities *(include if feature involves data)*

- **Claim Link / Authorization Key**: A secure, single-use URL carrying an ECDSA authorization
  key. The key's derived public address is the identity checked against the whitelist. The key
  never leaves the claimant's device.
- **Whitelist Entry**: A record in the registrar contract authorizing exactly one registration for
  a given public address; carries an unused/used state.
- **Claimed Name**: The label chosen by the claimant, ENS-normalized (ENSIP-15), combined with the
  fixed postfix to form a fully-qualified name. The normalized label is what is signed and
  registered.
- **Associated Address**: The address the claimed name is mapped to (its forward-resolution
  target).
- **Registration Submission**: The (name, address, signature) triple submitted for on-chain
  registration, and the resulting registration record.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A first-time claimant can go from opening a valid link to a confirmed registration in
  under 2 minutes.
- **SC-002**: Claimants complete registration at zero cost to themselves — no gas paid and no
  wallet funded — in 100% of successful claims.
- **SC-003**: 100% of attempts to reuse an already-redeemed link, or to use a non-whitelisted
  link, are rejected with a distinct, understandable message and no registration.
- **SC-004**: At least 95% of claimants with a valid, unused link complete registration
  successfully on their first attempt.
- **SC-005**: The authorization key is never sent to or recorded by any server — verifiable as
  zero occurrences in server logs or network egress.
- **SC-006**: All primary claimant flows pass WCAG 2.2 AA validation (automated checks plus a
  manual keyboard and screen-reader pass).
- **SC-007**: Every defined error state (invalid link, non-whitelisted link, redeemed link, taken
  name, malformed input, submission failure) produces a distinct, actionable message — 100%
  coverage.

## Assumptions

- The application stack is predetermined as a Svelte + TypeScript single-page app (project
  constraint stated by the requester).
- Gas is sponsored via an **ERC-4337** account-abstraction **Paymaster**; the claimant submits a
  sponsored UserOperation rather than paying gas directly. (Confirmed in clarification; the earlier
  "ERC-4773" reference was a typo for ERC-4337.)
- The namespace is governed by a **project-controlled registrar smart contract** that issues names
  under a single fixed postfix; this is a custom registrar rather than canonical `.eth` ENS. The
  whitelist, single-use enforcement, and registration all live in that contract. (Confirmed in
  clarification.)
- The embedded key is an ECDSA (secp256k1) private key carried in the URL in a way that keeps it
  client-side only (e.g., the URL fragment), so it is never sent to a server. Its sole role is to
  sign the `(name, address)` pair; the on-chain transaction is sent by a Paymaster-sponsored
  account, which need not be the key holder.
- A single whitelist entry authorizes exactly one registration; uniqueness of names under the
  postfix is enforced on-chain by the contract.
- The "address to associate" is the forward-resolution target the registered name maps to.
- Entered names are normalized per ENSIP-15 before being signed and submitted, so the signed and
  registered label is the normalized form (avoiding signature/registration mismatch).
- The registrar contract, the whitelist, and the Paymaster are deployed and managed outside this
  application; the app integrates with already-existing on-chain components.
- The specific chain/network and contract addresses are finalized during planning.
- Secure distribution of the one-time claim URL to claimants is handled upstream and is out of
  scope for this feature.

### Out of Scope

- Generating authorization keys and adding addresses to the whitelist.
- Deploying or administering the registrar contract, the postfix parent name, or the Paymaster.
- Post-registration name management (editing records, transfers, renewals).
- Distributing or delivering the secure claim links to recipients.

### Dependencies

- A deployed registrar smart contract that holds the whitelist and performs signature-verified,
  single-use registration under the fixed postfix.
- An available gas-sponsorship mechanism (Paymaster) with sufficient funding.
- Read/write access to the target chain (an RPC/network endpoint) for submitting registrations and
  checking name availability and link status.
