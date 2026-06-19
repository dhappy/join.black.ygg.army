# Contract: Registrar Interface (consumed by the app)

The registrar is a **project-controlled smart contract** deployed externally (out of scope to build
here). This document is the interface contract the app depends on. The implementation team confirms
or adjusts the registrar to match; mismatches are integration failures.

> **STATUS: UNVERIFIED.** The signatures, `Registered` event, and EIP-712 domain below are the
> interface the app is coded against. They MUST be confirmed against the actually-deployed registrar
> (ABI + domain `name`/`version`) before tasks T010/T011/T022. Any mismatch is an integration defect.

## Reads

```solidity
// Whitelist status for a derived signer address.
function whitelist(address account) external view returns (bool authorized, bool used);

// Name availability under the fixed postfix.
function available(string calldata label) external view returns (bool);
```

The app uses `whitelist(signerAddress)` to choose between `Ready` / `NotAuthorized` /
`AlreadyRedeemed`, and `available(labelNormalized)` to pre-check before submission (FR-006, FR-009,
FR-013).

## Write

```solidity
// Registers `label` under the fixed postfix, associating `target`.
// Recovers the signer from `signature` (see EIP-712 below), requires it be whitelisted and unused,
// requires `label` available, marks the whitelist entry used, and registers the name.
function register(
    string calldata label,
    address target,
    bytes calldata signature
) external;
```

- Authorization depends on the **recovered signer**, not `msg.sender` (clarify Q3 / FR-006), so a
  Paymaster-sponsored smart account may submit it.
- MUST revert on: signer not whitelisted, entry already used, label unavailable, malformed input.

## Events

```solidity
event Registered(bytes32 indexed node, string label, address indexed target, address indexed registrant);
```

The app waits for `Registered` (via the UserOp receipt) to enter `Success` and display the
fully-qualified name (FR-007).

## EIP-712 typed data (the signature the app produces)

```text
domain = {
  name:              "<registrar name>",      // e.g. "BlackYggArmyRegistrar"
  version:           "1",
  chainId:           <configured chainId>,
  verifyingContract: <registrar address>
}

types.Registration = [
  { name: "label",  type: "string" },
  { name: "target", type: "address" }
]

message = { label: labelNormalized, target: targetAddress }
```

- The signature is produced client-side by the embedded key and passed as `signature` to `register`.
- The **normalized** label is signed (must equal the on-chain `label` argument) to avoid mismatch.
- Domain binding to `chainId` + `verifyingContract` prevents cross-chain/cross-contract replay
  (Principle III).

## Configuration the app needs (public, build-time)

| Key | Meaning |
|-----|---------|
| `REGISTRAR_ADDRESS` | Registrar contract address. |
| `POSTFIX` | The fixed parent name (e.g., `black.ygg.army`). |
| `CHAIN_ID` / `RPC_URL` | Target chain + read endpoint. |
| `REGISTRAR_NAME` / `REGISTRAR_VERSION` | EIP-712 domain values. |
