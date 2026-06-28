# Contract: Registrar Interface (consumed by the app)

The registrar is a **project-controlled smart contract** deployed externally (out of scope to build
here). This document is the interface contract the app depends on. The implementation team confirms
or adjusts the registrar to match; mismatches are integration failures.

> **STATUS: UNVERIFIED.** The signatures, `Registered` event, and EIP-712 domain below are the
> interface the app is coded against. They MUST be confirmed against the actually-deployed registrar
> (ABI + domain `name`/`version`) before tasks T010/T011/T022. Any mismatch is an integration defect.

## Reads

```solidity
// Packed whitelist role bitfield / redeem-block for an address (see encoding below).
function whitelist(address account) external view returns (uint256);

// Name availability under the fixed postfix.
function available(string calldata label) external view returns (bool);
```

The app uses `whitelist(signerAddress)` to choose between `Ready` / `NotAuthorized` /
`AlreadyRedeemed`, `whitelist(connectedWallet)` to confirm the admin wallet holds the whitelister
role before whitelisting, and `available(labelNormalized)` to pre-check before submission (FR-006,
FR-009, FR-013).

### Whitelist value encoding (role bitfield)

The whitelist is a single `mapping(address => uint256)`. The low byte is a **role bitfield**; a
value at or above `FLAG_MASK = 2**8` is a **redeemed claimant** whose value is the block height it
was used at (a free audit trail). `0` MUST be the "no permissions" case — a Solidity mapping cannot
distinguish an absent key from a stored zero.

| Sentinel | Meaning |
|----------|---------|
| `0` | no permissions |
| bit 0 `CLAIMANT` (1) | whitelisted to claim a name once |
| bit 1 `WHITELISTER` (2) | may grant/deny `CLAIMANT` |
| bit 2 `ADMIN` (4) | may grant/deny `WHITELISTER` (implies `WHITELISTER`) |
| bit 3 `SUPERADMIN` (8) | may grant/deny `ADMIN` and `SUPERADMIN` (implies `ADMIN` + `WHITELISTER`) |
| `>= 2**8` | used — the value is the block height it was redeemed at |

Roles are cumulative: granting a role also grants every role beneath it. The deployer is seeded as a
superadmin. `register` requires `block.number >= 2**8` so a redeem block can never be mistaken for a
flag, and role checks guard with `sentinel < 2**8` so a redeemed claimant holds no roles. The app
decodes this in `src/lib/registrar/roles.ts` (`decodeWhitelist`).

## Write

```solidity
// Whitelister: mark each account a whitelisted, unused claimant (grants CLAIMANT).
function bulkWhitelist(address[] calldata accounts) external; // requires WHITELISTER

// Admin: grant the whitelister role.            Superadmin: grant the admin / superadmin role.
function bulkSetWhitelisters(address[] calldata accounts) external; // requires ADMIN
function bulkSetAdmins(address[] calldata accounts) external;       // requires SUPERADMIN
function bulkSetSuperadmins(address[] calldata accounts) external;  // requires SUPERADMIN

// Revoke role flags from each account; caller must be able to grant those same flags.
function deny(address[] calldata accounts, uint256 flags) external;

// Registers `label` under the fixed postfix, associating `target`.
// Recovers the signer from `signature` (see EIP-712 below), requires it hold CLAIMANT and be unused,
// requires `label` available, marks the entry used (= block.number), and registers the name.
function register(
    string calldata label,
    address target,
    bytes calldata signature
) external;
```

- `bulkWhitelist` is the admin path the bulk-whitelist UI calls via a connected wallet holding the
  whitelister role (`src/lib/admin/whitelist.ts`); the caller pays gas. MUST revert when the caller
  lacks `WHITELISTER`.
- Grants are additive (`|=`) and cumulative downward; `deny` clears flags (`&= ~flags`).
- `register` authorization depends on the **recovered signer**, not `msg.sender` (clarify Q3 /
  FR-006), so a Paymaster-sponsored smart account may submit it.
- `register` MUST revert on: signer lacks `CLAIMANT`, entry already used, label unavailable, malformed input.

## Events

```solidity
event Whitelisted(address indexed account);
event WhitelisterSet(address indexed account);
event AdminSet(address indexed account);
event SuperadminSet(address indexed account);
event Denied(address indexed account, uint256 flags);
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
