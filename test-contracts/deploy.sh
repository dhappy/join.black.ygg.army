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
#   CONFIRM_MAINNET    must be "yes" to deploy to a mainnet (real funds, irreversible)
#   ACCOUNT            cast keystore account name (`cast wallet import <name>`) — preferred
#   PRIVATE_KEY        alternative to ACCOUNT (discouraged: appears in process args)
#   REGISTRAR_NAME     EIP-712 domain name    (default BlackYggArmyRegistrar) — must equal PUBLIC_REGISTRAR_NAME
#   REGISTRAR_VERSION  EIP-712 domain version (default 1)                      — must equal PUBLIC_REGISTRAR_VERSION
#   POSTFIX            name postfix / .env hint (default black.ygg.army). For ens kind it is the
#                      parent ENS name; its namehash is the parentNode.
#   REGISTRAR_KIND     mock (default, test) | ens (production: registers real ENS subnames)
#   ENS_REGISTRY       (ens) ENS registry address (default canonical 0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e)
#   ENS_RESOLVER       (ens, REQUIRED) the network's Public Resolver address
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
else
	echo "error: set ACCOUNT=<keystore name> (run 'cast wallet import <name>') or PRIVATE_KEY" >&2
	exit 1
fi

resolve_registrar

echo "Deploying ${CONTRACT##*:} (kind=${REGISTRAR_KIND:-mock}) to ${NETWORK} (chainId=${CHAIN_ID}, ${RPC_URL})"
OUT="$(forge create "$CONTRACT" \
	--rpc-url "$RPC_URL" \
	"${SIGNER[@]}" \
	--broadcast \
	--constructor-args "${CONSTRUCTOR_ARGS[@]}")"
echo "$OUT"

REGISTRAR="$(echo "$OUT" | grep -oE 'Deployed to: 0x[a-fA-F0-9]{40}' | awk '{print $3}')"
if [[ -z "$REGISTRAR" ]]; then
	echo "error: could not parse the deployed address from forge output" >&2
	exit 1
fi

for addr in "$@"; do
	echo "Whitelisting ${addr}"
	cast send "$REGISTRAR" "allow(address)" "$addr" --rpc-url "$RPC_URL" "${SIGNER[@]}" >/dev/null
done

cat <<EOF

Deployed to ${EXPLORER_URL:-?}/address/${REGISTRAR}

Add to your .env:

  PUBLIC_CHAIN_ID=${CHAIN_ID}
  PUBLIC_RPC_URL=${RPC_URL}
  PUBLIC_REGISTRAR_ADDRESS=${REGISTRAR}
  PUBLIC_REGISTRAR_NAME=${REGISTRAR_NAME}
  PUBLIC_REGISTRAR_VERSION=${REGISTRAR_VERSION}
  PUBLIC_POSTFIX=${POSTFIX}
EOF

if [[ "${REGISTRAR_KIND:-mock}" == "ens" ]]; then
	echo
	echo "ENS: transfer ownership of '${POSTFIX}' (parentNode ${PARENT_NODE}) to ${REGISTRAR} in the"
	echo "     ENS registry before it can register subnames. Test on Sepolia first; audit before mainnet."
fi

if [[ "$IS_MAINNET" == "1" ]]; then
	cat <<'EOF'
NOTE: Biconomy MEE *testnet* sponsorship does not apply on mainnet — configure a production MEE
node URL + API key + a funded project gas tank (Biconomy dashboard) for the gasless flow.
EOF
else
	echo "Gas: Biconomy MEE testnet sponsorship — no bundler/Paymaster config needed."
fi

echo
verify_contract "$REGISTRAR" "$CHAIN_ID"
