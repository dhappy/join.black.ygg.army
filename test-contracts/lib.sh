# Shared helpers for deploy.sh / verify.sh. Source after `cd`-ing into test-contracts/.

# resolve_network: set RPC_URL, EXPLORER_URL, PRESET_MAINNET from NETWORK (RPC_URL/EXPLORER_URL override).
resolve_network() {
	NETWORK="${NETWORK:-base-sepolia}"
	local rpc explorer mainnet chainid
	case "$NETWORK" in
		base-sepolia) rpc="https://sepolia.base.org"; explorer="https://sepolia.basescan.org"; mainnet=0; chainid=84532 ;;
		base)         rpc="https://mainnet.base.org"; explorer="https://basescan.org"; mainnet=1; chainid=8453 ;;
		mainnet|ethereum) rpc="https://ethereum-rpc.publicnode.com"; explorer="https://etherscan.io"; mainnet=1; chainid=1 ;;
		sepolia)      rpc="https://ethereum-sepolia-rpc.publicnode.com"; explorer="https://sepolia.etherscan.io"; mainnet=0; chainid=11155111 ;;
		optimism)     rpc="https://mainnet.optimism.io"; explorer="https://optimistic.etherscan.io"; mainnet=1; chainid=10 ;;
		op-sepolia)   rpc="https://sepolia.optimism.io"; explorer="https://sepolia-optimism.etherscan.io"; mainnet=0; chainid=11155420 ;;
		arbitrum)     rpc="https://arb1.arbitrum.io/rpc"; explorer="https://arbiscan.io"; mainnet=1; chainid=42161 ;;
		*) echo "error: unknown NETWORK '$NETWORK' — set RPC_URL and EXPLORER_URL explicitly" >&2; rpc=""; explorer=""; mainnet=0; chainid="" ;;
	esac
	RPC_URL="${RPC_URL:-$rpc}"
	EXPLORER_URL="${EXPLORER_URL:-$explorer}"
	PRESET_MAINNET="$mainnet"
	EXPECTED_CHAIN_ID="$chainid"
	if [[ -z "$RPC_URL" ]]; then
		echo "error: no RPC_URL (unknown NETWORK and no RPC_URL override)" >&2
		return 1
	fi
}

# resolve_registrar: set CONTRACT, CONSTRUCTOR_SIG, CONSTRUCTOR_ARGS[] (and PARENT_NODE for ens)
# from REGISTRAR_KIND + REGISTRAR_NAME/VERSION/POSTFIX/ENS_REGISTRY/ENS_RESOLVER.
resolve_registrar() {
	REGISTRAR_NAME="${REGISTRAR_NAME:-BlackYggdrasilRegistrar}"
	REGISTRAR_VERSION="${REGISTRAR_VERSION:-1}"
	POSTFIX="${POSTFIX:-black.ygg.army}"
	case "${REGISTRAR_KIND:-mock}" in
		mock)
			CONTRACT="src/MockRegistrar.sol:MockRegistrar"
			CONSTRUCTOR_SIG="constructor(string,string)"
			CONSTRUCTOR_ARGS=("$REGISTRAR_NAME" "$REGISTRAR_VERSION")
			;;
		ens)
			ENS_REGISTRY="${ENS_REGISTRY:-0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e}"
			# The Public Resolver is set AFTER deploy (setResolver), NOT a constructor arg — so the
			# initcode is identical across chains and a CREATE2 deploy lands at the same address on
			# Mainnet + Sepolia. Known defaults per network; verify against
			# https://docs.ens.domains/learn/deployments before a real deploy (addresses can change).
			if [[ -z "${ENS_RESOLVER:-}" ]]; then
				case "${NETWORK:-}" in
					sepolia) ENS_RESOLVER="0xE99638b40E4Fff0129D56f03b55b6bbC4BBE49b5" ;;
					mainnet|ethereum) ENS_RESOLVER="0x231b0Ee14048e9dCcD1d247744d114a4EB5E8E63" ;;
				esac
			fi
			if [[ -z "${ENS_RESOLVER:-}" ]]; then
				echo "error: REGISTRAR_KIND=ens requires ENS_RESOLVER (the network's Public Resolver address)" >&2
				return 1
			fi
			# The superadmin (seeds the role bitfield) is an explicit constructor arg, because under a
			# CREATE2 factory deploy msg.sender is the factory, not you. Defaults to FROM (Frame); set
			# SUPERADMIN explicitly for a keystore deploy. Must be the same address on every chain to
			# keep the deterministic CREATE2 address identical.
			SUPERADMIN="${SUPERADMIN:-${FROM:-}}"
			if [[ -z "$SUPERADMIN" ]]; then
				echo "error: REGISTRAR_KIND=ens requires SUPERADMIN=<admin address> (constructor msg.sender is the CREATE2 factory, not you)" >&2
				return 1
			fi
			PARENT_NODE="$(cast namehash "$POSTFIX")"
			CONTRACT="src/EnsSubnameRegistrar.sol:EnsSubnameRegistrar"
			CONSTRUCTOR_SIG="constructor(string,string,address,bytes32,address)"
			CONSTRUCTOR_ARGS=("$REGISTRAR_NAME" "$REGISTRAR_VERSION" "$ENS_REGISTRY" "$PARENT_NODE" "$SUPERADMIN")
			;;
		*)
			echo "error: unknown REGISTRAR_KIND '${REGISTRAR_KIND}' (use mock or ens)" >&2
			return 1
			;;
	esac
}

# verify_contract <address> <chain_id>: run `forge verify-contract`, retrying while Etherscan has
# not yet indexed the freshly deployed contract. Requires resolve_registrar to have run. No-op
# without an API key. Never fails the caller (verification can always be re-run later).
verify_contract() {
	local address="$1" chain_id="$2"
	local api_key="${ETHERSCAN_API_KEY:-${BASESCAN_API_KEY:-}}"
	if [[ -z "$api_key" ]]; then
		echo "skip verify: set ETHERSCAN_API_KEY to verify on the explorer"
		return 0
	fi
	local args_hex
	args_hex="$(cast abi-encode "$CONSTRUCTOR_SIG" "${CONSTRUCTOR_ARGS[@]}")"
	local attempt
	for attempt in $(seq 1 "${VERIFY_ATTEMPTS:-10}"); do
		echo "Verifying ${CONTRACT##*:} on the explorer (chain ${chain_id}), attempt ${attempt}..."
		if forge verify-contract "$address" "$CONTRACT" \
			--chain "$chain_id" \
			--etherscan-api-key "$api_key" \
			--constructor-args "$args_hex" \
			--watch; then
			echo "Verified: $address"
			return 0
		fi
		echo "Not indexed yet or failed; retrying in ${VERIFY_DELAY:-15}s..."
		sleep "${VERIFY_DELAY:-15}"
	done
	echo "warning: verification did not complete. Re-run: ./test-contracts/verify.sh ${address}" >&2
	return 0
}
