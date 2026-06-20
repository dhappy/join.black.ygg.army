# Shared helpers for deploy.sh / verify.sh. Source after `cd`-ing into test-contracts/.

# resolve_network: set RPC_URL, EXPLORER_URL, PRESET_MAINNET from NETWORK (RPC_URL/EXPLORER_URL override).
resolve_network() {
	NETWORK="${NETWORK:-base-sepolia}"
	local rpc explorer mainnet
	case "$NETWORK" in
		base-sepolia) rpc="https://sepolia.base.org"; explorer="https://sepolia.basescan.org"; mainnet=0 ;;
		base)         rpc="https://mainnet.base.org"; explorer="https://basescan.org"; mainnet=1 ;;
		mainnet|ethereum) rpc="https://eth.llamarpc.com"; explorer="https://etherscan.io"; mainnet=1 ;;
		sepolia)      rpc="https://ethereum-sepolia-rpc.publicnode.com"; explorer="https://sepolia.etherscan.io"; mainnet=0 ;;
		optimism)     rpc="https://mainnet.optimism.io"; explorer="https://optimistic.etherscan.io"; mainnet=1 ;;
		op-sepolia)   rpc="https://sepolia.optimism.io"; explorer="https://sepolia-optimism.etherscan.io"; mainnet=0 ;;
		arbitrum)     rpc="https://arb1.arbitrum.io/rpc"; explorer="https://arbiscan.io"; mainnet=1 ;;
		*) echo "error: unknown NETWORK '$NETWORK' — set RPC_URL and EXPLORER_URL explicitly" >&2; rpc=""; explorer=""; mainnet=0 ;;
	esac
	RPC_URL="${RPC_URL:-$rpc}"
	EXPLORER_URL="${EXPLORER_URL:-$explorer}"
	PRESET_MAINNET="$mainnet"
	if [[ -z "$RPC_URL" ]]; then
		echo "error: no RPC_URL (unknown NETWORK and no RPC_URL override)" >&2
		return 1
	fi
}

# resolve_registrar: set CONTRACT, CONSTRUCTOR_SIG, CONSTRUCTOR_ARGS[] (and PARENT_NODE for ens)
# from REGISTRAR_KIND + REGISTRAR_NAME/VERSION/POSTFIX/ENS_REGISTRY/ENS_RESOLVER.
resolve_registrar() {
	REGISTRAR_NAME="${REGISTRAR_NAME:-BlackYggArmyRegistrar}"
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
			if [[ -z "${ENS_RESOLVER:-}" ]]; then
				echo "error: REGISTRAR_KIND=ens requires ENS_RESOLVER (the network's Public Resolver address)" >&2
				return 1
			fi
			PARENT_NODE="$(cast namehash "$POSTFIX")"
			CONTRACT="src/EnsSubnameRegistrar.sol:EnsSubnameRegistrar"
			CONSTRUCTOR_SIG="constructor(string,string,address,address,bytes32)"
			CONSTRUCTOR_ARGS=("$REGISTRAR_NAME" "$REGISTRAR_VERSION" "$ENS_REGISTRY" "$ENS_RESOLVER" "$PARENT_NODE")
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
