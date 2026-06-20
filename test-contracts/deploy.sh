#!/usr/bin/env bash
# Deploy the (test-only) MockRegistrar via `forge create`, then optionally whitelist addresses.
#
# Usage:
#   ACCOUNT=deployer ./test-contracts/deploy.sh [whitelist_addr ...]
#
# Env vars:
#   RPC_URL            default https://sepolia.base.org  (Base Sepolia, chain 84532 — where
#                      Biconomy's shared testnet gas tank lives, so MEE testnet sponsorship works)
#   ACCOUNT            cast keystore account name (`cast wallet import <name>`) — preferred
#   PRIVATE_KEY        alternative to ACCOUNT (discouraged: appears in process args)
#   REGISTRAR_NAME     EIP-712 domain name    (default BlackYggArmyRegistrar) — must equal PUBLIC_REGISTRAR_NAME
#   REGISTRAR_VERSION  EIP-712 domain version (default 1)                      — must equal PUBLIC_REGISTRAR_VERSION
#   POSTFIX            name postfix for the .env hint (default black.ygg.army)
#   BASESCAN_API_KEY   if set, verify the contract on the explorer
#
# Positional args: addresses to allow() (whitelist) right after deploy.
set -euo pipefail

RPC_URL="${RPC_URL:-https://sepolia.base.org}"
REGISTRAR_NAME="${REGISTRAR_NAME:-BlackYggArmyRegistrar}"
REGISTRAR_VERSION="${REGISTRAR_VERSION:-1}"
POSTFIX="${POSTFIX:-black.ygg.army}"

cd "$(dirname "$0")"

if [[ -n "${ACCOUNT:-}" ]]; then
	SIGNER=(--account "$ACCOUNT")
elif [[ -n "${PRIVATE_KEY:-}" ]]; then
	SIGNER=(--private-key "$PRIVATE_KEY")
else
	echo "error: set ACCOUNT=<keystore name> (run 'cast wallet import <name>') or PRIVATE_KEY" >&2
	exit 1
fi

VERIFY=()
if [[ -n "${BASESCAN_API_KEY:-}" ]]; then
	VERIFY=(--verify --verifier etherscan --etherscan-api-key "$BASESCAN_API_KEY")
fi

echo "Deploying MockRegistrar to ${RPC_URL} (name=${REGISTRAR_NAME} version=${REGISTRAR_VERSION})"
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

CHAIN_ID="$(cast chain-id --rpc-url "$RPC_URL")"
cat <<EOF

Deployed. Add to your .env:

  PUBLIC_CHAIN_ID=${CHAIN_ID}
  PUBLIC_RPC_URL=${RPC_URL}
  PUBLIC_REGISTRAR_ADDRESS=${REGISTRAR}
  PUBLIC_REGISTRAR_NAME=${REGISTRAR_NAME}
  PUBLIC_REGISTRAR_VERSION=${REGISTRAR_VERSION}
  PUBLIC_POSTFIX=${POSTFIX}

Gas: Biconomy MEE testnet sponsorship — no bundler/Paymaster config needed.
EOF
