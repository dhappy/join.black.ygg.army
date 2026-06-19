<!--
SYNC IMPACT REPORT
==================
Version change: (template, unversioned) → 1.0.0
Bump rationale: Initial ratification — template placeholders replaced with concrete
  principles for the join.black.ygg.army onboarding/auth flow. First governed version.

Modified principles:
  - [PRINCIPLE_1] → I. Accessible & Inclusive UX (NON-NEGOTIABLE)
  - [PRINCIPLE_2] → II. Privacy by Design & Data Minimization
  - [PRINCIPLE_3] → III. Secure Authentication & Onboarding
  - [PRINCIPLE_4] → IV. Simplicity & Minimal Dependencies
  - [PRINCIPLE_5] → V. Verifiable Quality

Added sections:
  - Security & Privacy Requirements (was [SECTION_2_NAME])
  - Development Workflow & Quality Gates (was [SECTION_3_NAME])

Removed sections: none

Templates requiring updates:
  - ✅ .specify/templates/plan-template.md — Constitution Check gate is generic
       ("[Gates determined based on constitution file]"); reads this file dynamically.
  - ✅ .specify/templates/spec-template.md — no constitution references; no change needed.
  - ✅ .specify/templates/tasks-template.md — no constitution references; no change needed.
  - ✅ .specify/templates/checklist-template.md — no constitution references; no change needed.

Follow-up TODOs: none
-->

# join.black.ygg.army Constitution

## Core Principles

### I. Accessible & Inclusive UX (NON-NEGOTIABLE)

Every onboarding and authentication screen MUST be usable by everyone, including users
relying on assistive technology. Specifically:

- Conform to WCAG 2.2 Level AA for all user-facing flows.
- Use semantic HTML; interactive elements MUST be reachable and operable by keyboard
  alone, with a visible focus indicator and a logical tab order.
- Provide text alternatives for non-text content and programmatic labels for every form
  field, error, and control.
- Maintain color contrast ratios meeting AA, and never convey meaning by color alone.
- Layouts MUST be responsive and functional from small mobile viewports upward.

**Rationale**: An onboarding flow that excludes people fails at its only job — letting
people in. Accessibility is a gate, not a polish step.

### II. Privacy by Design & Data Minimization

Collect the least data necessary to onboard a member, and protect it by default:

- Request only fields strictly required to complete authentication/provisioning; any
  additional field MUST have a documented justification.
- Obtain explicit, informed consent before collecting or transmitting personal data.
- No third-party trackers, analytics, or external scripts that exfiltrate user data
  without an explicit, documented justification approved in review.
- Define and enforce a retention boundary for any stored personal data; do not retain
  data beyond its stated purpose.

**Rationale**: Users hand over identity data at signup. Minimizing collection minimizes
both the harm surface and the trust we ask for.

### III. Secure Authentication & Onboarding

The auth path is the highest-risk surface and MUST be treated as such:

- All traffic carrying credentials or tokens MUST use TLS; never transmit secrets over
  plaintext.
- Secrets, API keys, and signing material MUST live in environment/secret configuration,
  never in source control or client bundles.
- Credentials and tokens MUST never be written to logs, error messages, or analytics.
- Tokens MUST be scoped and time-limited; sessions MUST expire and be revocable.
- Defend the flow against CSRF, replay, and brute-force/credential-stuffing attacks with
  appropriate mitigations (e.g., anti-CSRF tokens, rate limiting, lockout/backoff).

**Rationale**: A single weakness in the auth flow compromises every member it onboards.

### IV. Simplicity & Minimal Dependencies

Prefer the simplest implementation that satisfies the requirement (YAGNI):

- Every added dependency MUST be justified; dependencies in the authentication path face
  heightened scrutiny for maintenance status, footprint, and supply-chain risk.
- Prefer platform and framework primitives over bespoke abstractions.
- Do not build for hypothetical future requirements; add complexity only when a real,
  present need demands it.

**Rationale**: Each dependency and abstraction is attack surface and maintenance debt,
amplified in a security-sensitive flow.

### V. Verifiable Quality

Quality MUST be demonstrable, not assumed:

- Onboarding and authentication flows MUST have automated tests covering their critical
  paths, including failure and error states.
- Accessibility checks (automated where possible, manual keyboard/screen-reader pass for
  key flows) MUST be part of validation.
- Changes MUST pass the defined quality gates (lint, type checks, tests) before merge.

**Rationale**: Auth and onboarding regressions are silent and costly; automated
verification catches them before users do.

## Security & Privacy Requirements

- **Stack**: The project is built on a modern JavaScript framework with a build pipeline.
  Build output MUST NOT embed secrets; client bundles are considered public.
- **Transport**: HTTPS/TLS is mandatory in all deployed environments.
- **Dependencies**: Run dependency vulnerability auditing in CI; known high/critical
  advisories in shipped dependencies MUST be resolved or explicitly risk-accepted in
  review before release.
- **Data handling**: Personal data is encrypted in transit; storage and retention follow
  Principle II. Access to collected data is limited to what the flow requires.
- **Browser support**: Core onboarding MUST function with progressive enhancement so the
  primary path degrades gracefully when advanced features are unavailable.

## Development Workflow & Quality Gates

- **Review**: Every change is reviewed before merge. Reviewers MUST verify compliance with
  the principles above, with explicit attention to Accessibility (I) and Security/Privacy
  (II, III).
- **Gates**: Lint, type checks, automated tests, and dependency audit MUST pass before a
  change merges. Accessibility validation is required for changes touching user-facing
  flows.
- **Justified complexity**: Any deviation from Principle IV (new dependency, new
  abstraction, additional collected data) MUST be documented and justified in the change
  description and approved in review.

## Governance

This constitution supersedes other development practices for this project. When guidance
conflicts, the constitution wins.

- **Amendments**: Proposed amendments MUST be documented with rationale and reviewed and
  approved before taking effect. Breaking or removing a principle requires a migration
  note describing the impact on existing flows.
- **Versioning**: This constitution follows semantic versioning — MAJOR for backward
  incompatible governance/principle removals or redefinitions, MINOR for newly added or
  materially expanded principles/sections, PATCH for clarifications and non-semantic
  refinements.
- **Compliance review**: Pull requests and reviews MUST verify compliance with these
  principles. Non-compliance blocks merge until resolved or an approved, documented
  exception is recorded.

**Version**: 1.0.0 | **Ratified**: 2026-06-19 | **Last Amended**: 2026-06-19
