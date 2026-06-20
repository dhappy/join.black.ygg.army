# Contract: Gasless Integration (Biconomy MEE)

How the app delivers the `register` call gaslessly, via **Biconomy MEE testnet sponsorship**
(`@biconomy/abstractjs`). On testnets this needs **no** bundler/Paymaster URLs, EntryPoint address,
or dashboard — the SDK supplies them. See https://docs.biconomy.io/gasless-apps/testnet-sponsorship.

## Flow

1. Build a **Nexus** smart account from the embedded key:
   `toMultichainNexusAccount({ chainConfigurations: [{ chain, transport, version }], signer })`.
2. Create the MEE client against the staging network:
   `createMeeClient({ account, url: getDefaultMEENetworkUrl(true), apiKey: getDefaultMEENetworkApiKey(true) })`.
3. Encode `data` = `registrar.register(label, target, signature)` where `signature` is the EIP-712
   signature from `contracts/registrar-interface.md`.
4. Submit a **sponsored supertransaction**:
   `execute({ instructions: [{ calls: [{ to: REGISTRAR, data }], chainId }], sponsorship: true, sponsorshipOptions: { url: getDefaultMEENetworkUrl(true), gasTank: getDefaultMeeGasTank(true) } })`
   → returns `{ hash }`. Claimant pays nothing (FR-005, SC-002).
5. Await `waitForSupertransactionReceipt({ hash })`; on success → `Success` (the `Registered` event
   is emitted on-chain); on revert/sponsorship/network failure → `Failed` (FR-012).

Authorization note: the registrar checks the **recovered `(label,target)` signer**, independent of
the MEE/Nexus sender — the AA account is only the gasless transport (clarify Q3).

## Configuration the app needs (public, build-time)

None specific to sponsorship — Biconomy testnet sponsorship is out-of-the-box. The app only needs
the chain/RPC, registrar address, postfix, and EIP-712 domain (see `registrar-interface.md`).

For **production**, switch the MEE client to a configured node URL + API key and a project gas tank
(Biconomy dashboard); this is a configuration change, not a code change.

## Failure modes the app handles (FR-012)

- Sponsorship declined/unavailable → `SponsorshipFailed` (actionable message).
- MEE/network error or on-chain revert → `SubmissionFailed` (retryable).
- Availability lost between pre-check and inclusion (race) → registrar reverts → `NameTaken`.
