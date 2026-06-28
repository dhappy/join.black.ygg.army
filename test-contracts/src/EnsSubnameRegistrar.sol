// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @notice Minimal subset of the ENS registry.
interface IENS {
	function owner(bytes32 node) external view returns (address);
	function recordExists(bytes32 node) external view returns (bool);
	function setSubnodeRecord(
		bytes32 node,
		bytes32 label,
		address owner,
		address resolver,
		uint64 ttl
	) external;
}

/// @notice Minimal subset of a resolver's ETH address record.
interface IAddrResolver {
	function setAddr(bytes32 node, address a) external;
}

/// @notice Registers ENS subnames under a fixed parent, gated by an EIP-712 signature from a
/// whitelisted, single-use key. The registered subname is owned by THIS contract (control retained)
/// and forward-resolves (addr record) to the claimant's `target`, per spec FR-007a.
///
/// The EIP-712 scheme, whitelist, single-use, `register`/`available`/`whitelist` reads, and
/// `Registered` event match MockRegistrar, so the client app's signing and ABI are unchanged — only
/// the on-chain effect differs (real ENS records instead of a boolean).
///
/// DEPLOYMENT PRECONDITION: this contract must own `parentNode` in the ENS registry (transfer the
/// parent name's ownership to this contract, or approve it), so it can create subnodes.
///
/// PRODUCTION CONTRACT — get it audited and exercise it on a testnet (Sepolia) before mainnet use.
contract EnsSubnameRegistrar {
	// Single packed whitelist slot per address. The low byte holds role flags; a redeemed claimant
	// overwrites the slot with the block height it was used at — always >= FLAG_MASK on a live
	// chain, so a block height can never be mistaken for flags (see registrar-interface.md). 0 is
	// "no permissions" (a mapping cannot tell an absent key from a stored zero).
	//   0                        → nothing
	//   bit 0  CLAIMANT    (1)   → whitelisted to claim a name once
	//   bit 1  WHITELISTER (2)   → may grant/deny CLAIMANT
	//   bit 2  ADMIN       (4)   → may grant/deny WHITELISTER          (implies WHITELISTER)
	//   bit 3  SUPERADMIN  (8)   → may grant/deny ADMIN and SUPERADMIN (implies ADMIN + WHITELISTER)
	//   value >= FLAG_MASK       → used; the value is the block height it was redeemed at
	uint256 internal constant CLAIMANT = 1;
	uint256 internal constant WHITELISTER = 2;
	uint256 internal constant ADMIN = 4;
	uint256 internal constant SUPERADMIN = 8;
	// First value past the reserved flag byte: role flags are < FLAG_MASK, block heights are >=.
	uint256 internal constant FLAG_MASK = 2 ** 8;

	// Cumulative grants: each role carries the powers of every role beneath it.
	uint256 internal constant ADMIN_ROLE = ADMIN | WHITELISTER;
	uint256 internal constant SUPERADMIN_ROLE = SUPERADMIN | ADMIN | WHITELISTER;

	mapping(address => uint256) public whitelist;

	IENS public immutable ens;
	bytes32 public immutable parentNode;
	// Set post-deploy (not a constructor arg) so the deploy initcode is identical across chains —
	// enabling the same CREATE2 address on Mainnet + Sepolia despite their different resolvers.
	address public resolver;

	bytes32 private constant REGISTRATION_TYPEHASH =
		keccak256("Registration(string label,address target)");
	bytes32 private immutable DOMAIN_SEPARATOR;

	event Whitelisted(address indexed account);
	event WhitelisterSet(address indexed account);
	event AdminSet(address indexed account);
	event SuperadminSet(address indexed account);
	event Denied(address indexed account, uint256 flags);
	event ResolverSet(address indexed resolver);
	event Registered(
		bytes32 indexed node,
		string label,
		address indexed target,
		address indexed registrant
	);

	// Each modifier checks the caller holds the flag and isn't a spent claimant (value >= FLAG_MASK).
	// The deployer is seeded with the superadmin role (hence all roles) in the constructor.
	modifier onlyWhitelister() {
		uint256 p = whitelist[msg.sender];
		require(p < FLAG_MASK && p & WHITELISTER != 0, "not a whitelister");
		_;
	}
	modifier onlyAdmin() {
		uint256 p = whitelist[msg.sender];
		require(p < FLAG_MASK && p & ADMIN != 0, "not an admin");
		_;
	}
	modifier onlySuperadmin() {
		uint256 p = whitelist[msg.sender];
		require(p < FLAG_MASK && p & SUPERADMIN != 0, "not a superadmin");
		_;
	}

	// `superadmin` is an explicit arg, not msg.sender: under a CREATE2 factory deploy msg.sender is
	// the factory, so seeding msg.sender would brick admin. Pass the same address on every chain to
	// keep the deterministic CREATE2 address identical.
	constructor(
		string memory name,
		string memory version,
		address ensRegistry,
		bytes32 parentNode_,
		address superadmin
	) {
		require(superadmin != address(0), "zero superadmin");
		whitelist[superadmin] = SUPERADMIN_ROLE;
		ens = IENS(ensRegistry);
		parentNode = parentNode_;
		DOMAIN_SEPARATOR = keccak256(
			abi.encode(
				keccak256(
					"EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"
				),
				keccak256(bytes(name)),
				keccak256(bytes(version)),
				block.chainid,
				address(this)
			)
		);
	}

	/// @notice Superadmin: set the ENS Public Resolver for new subnames. Kept out of the constructor
	/// so the deploy initcode (and thus the CREATE2 address) matches across chains; MUST be set before
	/// the first register().
	function setResolver(address resolver_) external onlySuperadmin {
		resolver = resolver_;
		emit ResolverSet(resolver_);
	}

	/// @notice Whitelister: mark each account a whitelisted, unused claimant.
	function bulkWhitelist(address[] calldata accounts) external onlyWhitelister {
		for (uint256 i = 0; i < accounts.length; i++) {
			_grant(accounts[i], CLAIMANT);
			emit Whitelisted(accounts[i]);
		}
	}

	/// @notice Admin: grant each account the whitelister role.
	function bulkSetWhitelisters(address[] calldata accounts) external onlyAdmin {
		for (uint256 i = 0; i < accounts.length; i++) {
			_grant(accounts[i], WHITELISTER);
			emit WhitelisterSet(accounts[i]);
		}
	}

	/// @notice Superadmin: grant each account the admin role (also a whitelister).
	function bulkSetAdmins(address[] calldata accounts) external onlySuperadmin {
		for (uint256 i = 0; i < accounts.length; i++) {
			_grant(accounts[i], ADMIN_ROLE);
			emit AdminSet(accounts[i]);
		}
	}

	/// @notice Superadmin: grant each account the superadmin role (also admin + whitelister).
	function bulkSetSuperadmins(address[] calldata accounts) external onlySuperadmin {
		for (uint256 i = 0; i < accounts.length; i++) {
			_grant(accounts[i], SUPERADMIN_ROLE);
			emit SuperadminSet(accounts[i]);
		}
	}

	/// @notice Revoke `flags` from each account. The caller may only revoke flags it could grant
	/// (whitelister→CLAIMANT, admin→WHITELISTER, superadmin→ADMIN/SUPERADMIN).
	function deny(address[] calldata accounts, uint256 flags) external {
		require(flags != 0 && flags < FLAG_MASK, "bad flags");
		require(_canManage(msg.sender, flags), "not authorized");
		for (uint256 i = 0; i < accounts.length; i++) {
			_revoke(accounts[i], flags);
			emit Denied(accounts[i], flags);
		}
	}

	/// @notice Authorize a single address for exactly one registration.
	function allow(address account) external onlyWhitelister {
		_grant(account, CLAIMANT);
		emit Whitelisted(account);
	}

	function available(string calldata label) external view returns (bool) {
		return !ens.recordExists(_node(label));
	}

	function register(string calldata label, address target, bytes calldata signature) external {
		require(block.number >= FLAG_MASK, "chain too young"); // keeps used-block out of flag space
		require(resolver != address(0), "resolver unset"); // setResolver() must run after deploy
		bytes32 structHash = keccak256(
			abi.encode(REGISTRATION_TYPEHASH, keccak256(bytes(label)), target)
		);
		bytes32 digest = keccak256(abi.encodePacked("\x19\x01", DOMAIN_SEPARATOR, structHash));
		address signer = _recover(digest, signature);

		uint256 perms = whitelist[signer];
		require(perms < FLAG_MASK, "already used"); // a block height means already redeemed
		require(perms & CLAIMANT != 0, "not whitelisted");

		bytes32 labelhash = keccak256(bytes(label));
		bytes32 node = keccak256(abi.encodePacked(parentNode, labelhash));
		require(!ens.recordExists(node), "name taken");

		whitelist[signer] = block.number; // record the redeem block (the used marker)

		// Create the subnode owned by this contract, with the resolver set, then point it at target.
		ens.setSubnodeRecord(parentNode, labelhash, address(this), resolver, 0);
		IAddrResolver(resolver).setAddr(node, target);

		emit Registered(node, label, target, signer);
	}

	// Add role flags to an account's existing permissions (never overwrites).
	function _grant(address account, uint256 flags) private {
		whitelist[account] |= flags;
	}

	// Clear role flags from an account, leaving any others intact.
	function _revoke(address account, uint256 flags) private {
		whitelist[account] &= ~flags;
	}

	// True if `who` holds the role required to grant or revoke every flag in `flags`.
	function _canManage(address who, uint256 flags) private view returns (bool) {
		uint256 p = whitelist[who];
		if (p >= FLAG_MASK) return false; // a spent claimant manages nothing
		if (flags & CLAIMANT != 0 && p & WHITELISTER == 0) return false;
		if (flags & WHITELISTER != 0 && p & ADMIN == 0) return false;
		if (flags & (ADMIN | SUPERADMIN) != 0 && p & SUPERADMIN == 0) return false;
		return true;
	}

	function _node(string calldata label) private view returns (bytes32) {
		return keccak256(abi.encodePacked(parentNode, keccak256(bytes(label))));
	}

	function _recover(bytes32 digest, bytes calldata sig) private pure returns (address) {
		require(sig.length == 65, "bad sig length");
		bytes32 r;
		bytes32 s;
		uint8 v;
		assembly {
			r := calldataload(sig.offset)
			s := calldataload(add(sig.offset, 32))
			v := byte(0, calldataload(add(sig.offset, 64)))
		}
		return ecrecover(digest, v, r, s);
	}
}
