#!/usr/bin/env bash
# Verify an already-deployed registrar on the explorer (retries until Etherscan has indexed it).
#
# Usage:
#   NETWORK=mainnet REGISTRAR_KIND=ens ENS_RESOLVER=0x... POSTFIX=black.ygg.army \
#     ETHERSCAN_API_KEY=... ACCOUNT-irrelevant ./test-contracts/verify.sh <DEPLOYED_ADDRESS>
#
# Pass the SAME env that produced the deployment (NETWORK / REGISTRAR_KIND / REGISTRAR_NAME /
# REGISTRAR_VERSION / POSTFIX / ENS_REGISTRY / ENS_RESOLVER) so the constructor args match.
set -euo pipefail

cd "$(dirname "$0")"
source ./lib.sh

ADDRESS="${1:-${ADDRESS:-}}"
if [[ -z "$ADDRESS" ]]; then
	echo "usage: ./test-contracts/verify.sh <deployed-address>" >&2
	exit 1
fi
if [[ -z "${ETHERSCAN_API_KEY:-${BASESCAN_API_KEY:-}}" ]]; then
	echo "error: set ETHERSCAN_API_KEY" >&2
	exit 1
fi

resolve_network
resolve_registrar
CHAIN_ID="$(cast chain-id --rpc-url "$RPC_URL")"

verify_contract "$ADDRESS" "$CHAIN_ID"
