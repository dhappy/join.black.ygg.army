#!/usr/bin/env bash
# Deploy the (test-only) MockRegistrar via `forge create`, then optionally whitelist addresses.
#
# Usage:
#   NETWORK=base-sepolia ACCOUNT=deployer ./test-contracts/deploy.sh [whitelist_addr ...]
#
# Env vars:
#   NETWORK            preset: base-sepolia (default) | base | mainnet | sepolia | optimism |
#                      op-sepolia | arbitrum. Sets RPC + explorer. Override either with RPC_URL /
#                      EXPLORER_URL. Mainnets require CONFIRM_MAINNET=yes.
#   RPC_URL            override the preset RPC endpoint
#   EXPLORER_URL       override the preset block-explorer base
#   CONFIRM_MAINNET    must be "yes" to deploy to a mainnet (real funds, irreversible)
#   ACCOUNT            cast keystore account name (`cast wallet import <name>`) — preferred
#   PRIVATE_KEY        alternative to ACCOUNT (discouraged: appears in process args)
#   REGISTRAR_NAME     EIP-712 domain name    (default BlackYggArmyRegistrar) — must equal PUBLIC_REGISTRAR_NAME
#   REGISTRAR_VERSION  EIP-712 domain version (default 1)                      — must equal PUBLIC_REGISTRAR_VERSION
#   POSTFIX            name postfix for the .env hint (default black.ygg.army)
#   ETHERSCAN_API_KEY  if set, verify the contract on the explorer (BASESCAN_API_KEY also accepted)
#
# Positional args: addresses to allow() (whitelist) right after deploy.
set -euo pipefail

NETWORK="${NETWORK:-base-sepolia}"
REGISTRAR_NAME="${REGISTRAR_NAME:-BlackYggArmyRegistrar}"
REGISTRAR_VERSION="${REGISTRAR_VERSION:-1}"
POSTFIX="${POSTFIX:-black.ygg.army}"

case "$NETWORK" in
	base-sepolia) RPC_DEFAULT="https://sepolia.base.org"; EXPLORER_DEFAULT="https://sepolia.basescan.org"; PRESET_MAINNET=0 ;;
	base)         RPC_DEFAULT="https://mainnet.base.org"; EXPLORER_DEFAULT="https://basescan.org"; PRESET_MAINNET=1 ;;
	mainnet|ethereum) RPC_DEFAULT="https://eth.llamarpc.com"; EXPLORER_DEFAULT="https://etherscan.io"; PRESET_MAINNET=1 ;;
	sepolia)      RPC_DEFAULT="https://ethereum-sepolia-rpc.publicnode.com"; EXPLORER_DEFAULT="https://sepolia.etherscan.io"; PRESET_MAINNET=0 ;;
	optimism)     RPC_DEFAULT="https://mainnet.optimism.io"; EXPLORER_DEFAULT="https://optimistic.etherscan.io"; PRESET_MAINNET=1 ;;
	op-sepolia)   RPC_DEFAULT="https://sepolia.optimism.io"; EXPLORER_DEFAULT="https://sepolia-optimism.etherscan.io"; PRESET_MAINNET=0 ;;
	arbitrum)     RPC_DEFAULT="https://arb1.arbitrum.io/rpc"; EXPLORER_DEFAULT="https://arbiscan.io"; PRESET_MAINNET=1 ;;
	*) echo "error: unknown NETWORK '$NETWORK' — set RPC_URL and EXPLORER_URL explicitly" >&2; RPC_DEFAULT=""; EXPLORER_DEFAULT=""; PRESET_MAINNET=0 ;;
esac

RPC_URL="${RPC_URL:-$RPC_DEFAULT}"
EXPLORER_URL="${EXPLORER_URL:-$EXPLORER_DEFAULT}"
if [[ -z "$RPC_URL" ]]; then
	echo "error: no RPC_URL (unknown NETWORK and no RPC_URL override)" >&2
	exit 1
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

cd "$(dirname "$0")"
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

VERIFY=()
API_KEY="${ETHERSCAN_API_KEY:-${BASESCAN_API_KEY:-}}"
if [[ -n "$API_KEY" ]]; then
	VERIFY=(--verify --verifier etherscan --etherscan-api-key "$API_KEY")
fi

echo "Deploying MockRegistrar to ${NETWORK} (chainId=${CHAIN_ID}, ${RPC_URL})"
OUT="$(forge create src/MockRegistrar.sol:MockRegistrar \
	--rpc-url "$RPC_URL" \
	"${SIGNER[@]}" \
	--broadcast \
	--constructor-args "$REGISTRAR_NAME" "$REGISTRAR_VERSION" \
	"${VERIFY[@]}")"
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

if [[ "$IS_MAINNET" == "1" ]]; then
	cat <<'EOF'
NOTE: Biconomy MEE *testnet* sponsorship does not apply on mainnet — configure a production MEE
node URL + API key + a funded project gas tank (Biconomy dashboard) for the gasless flow.
EOF
else
	echo "Gas: Biconomy MEE testnet sponsorship — no bundler/Paymaster config needed."
fi
