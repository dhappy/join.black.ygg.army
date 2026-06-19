# Contract: ERC-4337 Gasless Integration

How the app delivers the `register` call gaslessly. The bundler, Paymaster, EntryPoint, and account
factory are **external infrastructure provided by deployment config** (spec lists the Paymaster as
externally managed). This is the integration contract the app codes against.

## Flow

1. Build a counterfactual **smart account** owned by the embedded key (signer = `signerAddress`).
   First op carries `initCode` to deploy it.
2. Encode `callData` = call to `REGISTRAR_ADDRESS.register(label, target, signature)` where
   `signature` is the EIP-712 signature from `contracts/registrar-interface.md`.
3. Build a UserOperation; request **Paymaster sponsorship** so `maxFeePerGas`/`preVerificationGas`
   etc. are covered by the Paymaster (claimant pays nothing — FR-005, SC-002).
4. Sign the UserOperation with the embedded key (the account's owner signature).
5. Send to the **bundler**; record `userOpHash` → `Pending`.
6. Wait for the UserOp receipt; on success → `Success` (read `Registered` event); on revert or
   sponsorship/network failure → `Failed`/`SponsorshipFailed` (FR-012).

Authorization note: the registrar checks the **recovered `(label,target)` signer**, independent of
the smart-account sender — the AA account is only the gasless transport (clarify Q3).

## Configuration the app needs (public, build-time)

| Key | Meaning |
|-----|---------|
| `ENTRYPOINT_ADDRESS` | ERC-4337 EntryPoint (e.g., v0.7). |
| `BUNDLER_URL` | Bundler RPC endpoint. |
| `PAYMASTER_URL` | Sponsorship endpoint (see sponsorship policy below). |
| `ACCOUNT_FACTORY` / account type | Smart-account implementation (audited; e.g., Safe/Kernel). |

## Sponsorship policy (no client secret)

- **Required for this app:** a **project-owned Verifying Paymaster scoped on-chain** to the registrar
  address / `register` selector, funded with gas, whose endpoint needs no client-held secret. A
  static, backend-free client is only viable with this model; a secret-key-gated third-party
  Paymaster is **out of scope** and would require a separate (currently unplanned) serverless proxy.
- If a third-party Paymaster requiring a secret key is mandated, the minimal addition is a single
  stateless serverless function that returns Paymaster data only for registrar `register` calls.
  This proxy is **out of scope** here and flagged for the operator (it is the only case that would
  introduce any server component).

## Failure modes the app handles (FR-012)

- Paymaster declines or is unfunded → `SponsorshipFailed` (actionable message).
- Bundler/network error or UserOp revert → `SubmissionFailed` (retryable).
- Availability lost between pre-check and inclusion (race) → registrar reverts → `NameTaken`.
