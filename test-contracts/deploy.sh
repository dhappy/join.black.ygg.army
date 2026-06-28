#!/usr/bin/env bash
# Deploy a registrar via `forge create`, optionally whitelist addresses, then verify on the explorer.
#
# Usage:
#   NETWORK=base-sepolia ACCOUNT=deployer ./test-contracts/deploy.sh [whitelist_addr ...]
#
# Env vars:
#   NETWORK            preset: base-sepolia (default) | base | mainnet | sepolia | optimism |
#                      op-sepolia | arbitrum. Sets RPC + explorer. Override with RPC_URL / EXPLORER_URL.
#                      Mainnets require CONFIRM_MAINNET=yes.
#   RPC_URL            override the preset RPC endpoint
#   EXPLORER_URL       override the preset block-explorer base
#   SALT               if set, deploy via CREATE2 (deterministic): the same SALT + identical
#                      constructor args land at the SAME address on every chain (e.g. Mainnet &
#                      Sepolia). The ENS resolver is set post-deploy so initcode stays identical.
#   CONFIRM_MAINNET    must be "yes" to deploy to a mainnet (real funds, irreversible)
#   ACCOUNT            cast keystore account name (`cast wallet import <name>`) — preferred
#   PRIVATE_KEY        alternative to ACCOUNT (discouraged: appears in process args)
#   FRAME              FRAME=1 routes signing + payment through a running Frame wallet (RPC
#                      http://127.0.0.1:1248). Set FROM=<your Frame account>. Pick the target chain
#                      in Frame first; Frame prompts you to approve and pay each tx.
#   FROM               sender address for an unlocked wallet RPC (Frame, or a node); the wallet signs
#                      and pays. Alternative to ACCOUNT / PRIVATE_KEY.
#   REGISTRAR_NAME     EIP-712 domain name    (default BlackYggdrasilRegistrar) — must equal the chain's registrarName
#   REGISTRAR_VERSION  EIP-712 domain version (default 1)                      — must equal PUBLIC_REGISTRAR_VERSION
#   POSTFIX            name postfix / .env hint (default black.ygg.army). For ens kind it is the
#                      parent ENS name; its namehash is the parentNode.
#   REGISTRAR_KIND     mock (default, test) | ens (production: registers real ENS subnames)
#   ENS_REGISTRY       (ens) ENS registry address (default canonical 0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e)
#   ENS_RESOLVER       (ens) the network's Public Resolver address (sepolia has a built-in default)
#   SUPERADMIN         (ens, REQUIRED) address seeded with the superadmin role; defaults to FROM.
#                      NOT msg.sender (a CREATE2 deploy's msg.sender is the factory). Use the SAME
#                      address on every chain to keep the deterministic CREATE2 address identical.
#   ETHERSCAN_API_KEY  if set, verify the contract after deploy (BASESCAN_API_KEY also accepted)
#
# For REGISTRAR_KIND=ens the deployed contract must be made the OWNER of the parent node in ENS
# before it can register subnames. Audit and test on a testnet before mainnet.
#
# Positional args: addresses to allow() (whitelist) right after deploy.
set -euo pipefail

cd "$(dirname "$0")"
source ./lib.sh

resolve_network

# Frame (or any local wallet serving JSON-RPC): route reads + signing + payment through it. The
# chain is whatever you've selected in Frame, so the chain-id guards below still apply.
if [[ "${FRAME:-}" == "1" ]]; then
	RPC_URL="${FRAME_RPC:-http://127.0.0.1:1248}"
	: "${FROM:?FRAME=1 requires FROM=<your Frame account address>}"
fi

refuse_mainnet() {
	echo "Refusing to deploy to a MAINNET (network=$NETWORK${1:+ chainId=$1})." >&2
	echo "This broadcasts a real transaction and spends real funds, and is irreversible." >&2
	echo "Re-run with CONFIRM_MAINNET=yes to proceed." >&2
	exit 1
}

# Guard from the preset first, so a known mainnet refuses without even needing the RPC.
if [[ "$PRESET_MAINNET" == "1" && "${CONFIRM_MAINNET:-}" != "yes" ]]; then
	refuse_mainnet
fi

CHAIN_ID="$(cast chain-id --rpc-url "$RPC_URL")"

# Assert the connected chain matches the requested NETWORK. Catches a wallet/RPC on the wrong chain
# — e.g. FRAME=1 with Frame still on Mainnet (chainId 1) while you asked for sepolia (11155111).
if [[ -n "${EXPECTED_CHAIN_ID:-}" && "$CHAIN_ID" != "$EXPECTED_CHAIN_ID" ]]; then
	echo "error: connected chain is ${CHAIN_ID}, but NETWORK=${NETWORK} expects ${EXPECTED_CHAIN_ID}." >&2
	if [[ "${FRAME:-}" == "1" ]]; then
		echo "       Switch Frame's active network to ${NETWORK} (chainId ${EXPECTED_CHAIN_ID}) and re-run." >&2
	else
		echo "       Point RPC_URL at ${NETWORK}, or set NETWORK to match the RPC." >&2
	fi
	exit 1
fi

# Secondary guard: a custom RPC that actually points at a known mainnet chain id.
case "$CHAIN_ID" in
	1|8453|10|42161|137|56|43114|59144|534352|81457)
		IS_MAINNET=1
		if [[ "${CONFIRM_MAINNET:-}" != "yes" ]]; then refuse_mainnet "$CHAIN_ID"; fi
		;;
	*) IS_MAINNET="$PRESET_MAINNET" ;;
esac

if [[ -n "${ACCOUNT:-}" ]]; then
	SIGNER=(--account "$ACCOUNT")
elif [[ -n "${PRIVATE_KEY:-}" ]]; then
	SIGNER=(--private-key "$PRIVATE_KEY")
elif [[ -n "${FROM:-}" ]]; then
	# Sign via an unlocked wallet RPC (e.g. Frame): it prompts you to approve and pay. Pair with
	# FRAME=1 (or RPC_URL pointing at the wallet).
	SIGNER=(--unlocked --from "$FROM")
else
	echo "error: set ACCOUNT=<keystore name>, PRIVATE_KEY, or FROM=<addr> (+ FRAME=1 / wallet RPC)" >&2
	exit 1
fi

resolve_registrar

# Deploy. With SALT, go through the canonical CREATE2 factory directly (forge-create dropped --salt
# in Foundry v1): the address is keccak(0xff ++ factory ++ salt ++ keccak(initcode))[12:] — identical
# on every chain for the same salt + initcode. The ENS resolver is set post-deploy (not a constructor
# arg) precisely to keep that initcode equal across chains. Without SALT, a normal forge create.
DETERMINISTIC_DEPLOYER="0x4e59b44847b379578588920cA78FbF26c0B4956C"

echo "Deploying ${CONTRACT##*:} (kind=${REGISTRAR_KIND:-mock}) to ${NETWORK} (chainId=${CHAIN_ID}, ${RPC_URL})${SALT:+ via CREATE2 salt=$SALT}"
if [[ -n "${SALT:-}" ]]; then
	[[ "$SALT" =~ ^0x[0-9a-fA-F]{64}$ ]] || { echo "error: SALT must be 0x + 64 hex (32 bytes)" >&2; exit 1; }
	forge build >/dev/null
	INITCODE="$(forge inspect "$CONTRACT" bytecode)$(cast abi-encode "$CONSTRUCTOR_SIG" "${CONSTRUCTOR_ARGS[@]}" | sed 's/^0x//')"
	INIT_HASH="$(cast keccak "$INITCODE")"
	FULL="$(cast keccak "0xff${DETERMINISTIC_DEPLOYER#0x}${SALT#0x}${INIT_HASH#0x}")"
	REGISTRAR="$(cast to-checksum "0x${FULL: -40}")"
	EXISTING="$(cast code "$REGISTRAR" --rpc-url "$RPC_URL")"
	if [[ "$EXISTING" != "0x" && -n "$EXISTING" ]]; then
		echo "Already deployed at ${REGISTRAR} (same salt + initcode) — skipping create."
	else
		echo "CREATE2 → ${REGISTRAR}"
		cast send "$DETERMINISTIC_DEPLOYER" "${SALT}${INITCODE#0x}" --rpc-url "$RPC_URL" "${SIGNER[@]}" >/dev/null
		DEPLOYED="$(cast code "$REGISTRAR" --rpc-url "$RPC_URL")"
		[[ "$DEPLOYED" != "0x" && -n "$DEPLOYED" ]] || { echo "error: CREATE2 produced no code at ${REGISTRAR}" >&2; exit 1; }
	fi
else
	OUT="$(forge create "$CONTRACT" \
		--rpc-url "$RPC_URL" \
		"${SIGNER[@]}" \
		--broadcast \
		--constructor-args "${CONSTRUCTOR_ARGS[@]}")"
	echo "$OUT"
	REGISTRAR="$(echo "$OUT" | grep -oE 'Deployed to: 0x[a-fA-F0-9]{40}' | awk '{print $3}')"
fi

if [[ -z "${REGISTRAR:-}" ]]; then
	echo "error: could not determine the deployed address" >&2
	exit 1
fi

# ENS registrar needs its resolver set before it can register (kept out of the constructor for a
# cross-chain-stable CREATE2 address).
if [[ "${REGISTRAR_KIND:-mock}" == "ens" ]]; then
	echo "Setting resolver ${ENS_RESOLVER}"
	# Only the superadmin can call this. If the signer isn't it (e.g. superadmin is your Frame
	# account, signer is the keystore), don't fail the deploy — point at how to do it as superadmin.
	if ! cast send "$REGISTRAR" "setResolver(address)" "$ENS_RESOLVER" --rpc-url "$RPC_URL" "${SIGNER[@]}" >/dev/null 2>&1; then
		echo "  skipped: signer isn't the superadmin (${SUPERADMIN:-?}). Set it from that account:"
		echo "    ${EXPLORER_URL:-?}/address/${REGISTRAR}#writeContract → setResolver(${ENS_RESOLVER}) (connect Frame)"
	fi
fi

for addr in "$@"; do
	echo "Whitelisting ${addr}"
	cast send "$REGISTRAR" "allow(address)" "$addr" --rpc-url "$RPC_URL" "${SIGNER[@]}" >/dev/null 2>&1 \
		|| echo "  skipped allow(${addr}): signer isn't a whitelister — use the /whitelist admin UI with the superadmin."
done

cat <<EOF

Deployed to ${EXPLORER_URL:-?}/address/${REGISTRAR}

Add this entry to the PUBLIC_CHAINS JSON array in your .env (use your Alchemy RPC for rpcUrl, and a
Gas Manager policy id for this chain as gasPolicyId):

  {"chainId":${CHAIN_ID},"label":"${NETWORK}","rpcUrl":"${RPC_URL}","registrarAddress":"${REGISTRAR}","registrarName":"${REGISTRAR_NAME}","registrarVersion":"${REGISTRAR_VERSION}","postfix":"${POSTFIX}","explorerUrl":"${EXPLORER_URL}","gasPolicyId":"<gas-policy-id>"}

…and set PUBLIC_ALCHEMY_API_KEY (shared) + PUBLIC_DEFAULT_CHAIN_ID=${CHAIN_ID}. (The legacy flat
PUBLIC_CHAIN_ID / PUBLIC_RPC_URL / PUBLIC_REGISTRAR_* keys still work for a single chain.)
EOF

if [[ "${REGISTRAR_KIND:-mock}" == "ens" ]]; then
	echo
	echo "ENS: transfer ownership of '${POSTFIX}' (parentNode ${PARENT_NODE}) to ${REGISTRAR} in the"
	echo "     ENS registry before it can register subnames. Test on Sepolia first; audit before mainnet."
fi

cat <<'EOF'
Gas: gasless claims use Alchemy Account Kit + Gas Manager. Create a sponsorship policy for this
chain (Alchemy dashboard → Gas Manager), scope it (spend caps), and use its id as the chain's
gasPolicyId, plus a domain-allowlisted PUBLIC_ALCHEMY_API_KEY.
EOF
if [[ "$IS_MAINNET" == "1" ]]; then
	echo "NOTE: this is MAINNET — the gas policy spends REAL funds. Set conservative caps."
fi

echo
verify_contract "$REGISTRAR" "$CHAIN_ID"
