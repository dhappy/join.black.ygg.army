// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @notice Test-only mock of the registrar interface in contracts/registrar-interface.md.
/// It mirrors the documented reads/writes/event and EIP-712 scheme so the client's signing,
/// ABI, and single-use/whitelist semantics can be verified against a real EVM. NOT for production.
contract MockRegistrar {
	struct Entry {
		bool authorized;
		bool used;
	}

	mapping(address => Entry) public whitelist;
	mapping(bytes32 => bool) private registered;

	bytes32 private constant REGISTRATION_TYPEHASH =
		keccak256("Registration(string label,address target)");
	bytes32 private immutable DOMAIN_SEPARATOR;

	event Registered(
		bytes32 indexed node,
		string label,
		address indexed target,
		address indexed registrant
	);

	constructor(string memory name, string memory version) {
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

	/// @notice Test helper to add an address to the whitelist.
	function allow(address account) external {
		whitelist[account] = Entry({authorized: true, used: false});
	}

	function available(string calldata label) external view returns (bool) {
		return !registered[keccak256(bytes(label))];
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
		require(!registered[labelhash], "name taken");

		entry.used = true;
		registered[labelhash] = true;
		emit Registered(labelhash, label, target, signer);
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
