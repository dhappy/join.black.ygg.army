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
	struct Entry {
		bool authorized;
		bool used;
	}

	mapping(address => Entry) public whitelist;

	IENS public immutable ens;
	address public immutable resolver;
	bytes32 public immutable parentNode;
	address public owner;

	bytes32 private constant REGISTRATION_TYPEHASH =
		keccak256("Registration(string label,address target)");
	bytes32 private immutable DOMAIN_SEPARATOR;

	event Registered(
		bytes32 indexed node,
		string label,
		address indexed target,
		address indexed registrant
	);
	event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

	modifier onlyOwner() {
		require(msg.sender == owner, "not owner");
		_;
	}

	constructor(
		string memory name,
		string memory version,
		address ensRegistry,
		address resolver_,
		bytes32 parentNode_
	) {
		owner = msg.sender;
		ens = IENS(ensRegistry);
		resolver = resolver_;
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

	function transferOwnership(address newOwner) external onlyOwner {
		require(newOwner != address(0), "zero owner");
		emit OwnershipTransferred(owner, newOwner);
		owner = newOwner;
	}

	/// @notice Authorize an address for exactly one registration.
	function allow(address account) external onlyOwner {
		whitelist[account] = Entry({authorized: true, used: false});
	}

	function available(string calldata label) external view returns (bool) {
		return !ens.recordExists(_node(label));
	}

	function register(string calldata label, address target, bytes calldata signature) external {
		bytes32 structHash = keccak256(
			abi.encode(REGISTRATION_TYPEHASH, keccak256(bytes(label)), target)
		);
		bytes32 digest = keccak256(abi.encodePacked("\x19\x01", DOMAIN_SEPARATOR, structHash));
		address signer = _recover(digest, signature);

		Entry storage entry = whitelist[signer];
		require(entry.authorized, "not whitelisted");
		require(!entry.used, "already used");

		bytes32 labelhash = keccak256(bytes(label));
		bytes32 node = keccak256(abi.encodePacked(parentNode, labelhash));
		require(!ens.recordExists(node), "name taken");

		entry.used = true;

		// Create the subnode owned by this contract, with the resolver set, then point it at target.
		ens.setSubnodeRecord(parentNode, labelhash, address(this), resolver, 0);
		IAddrResolver(resolver).setAddr(node, target);

		emit Registered(node, label, target, signer);
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
