<script lang="ts">
	import { activeChainId, setActiveChainId } from '$lib/chain/active.svelte'
	import { listChains } from '$lib/chain/chains'

	const chains = listChains()
	const current = $derived(activeChainId())

	function onchange(event: Event) {
		setActiveChainId(Number((event.currentTarget as HTMLSelectElement).value))
	}
</script>

{#if chains.length > 1}
	<label class="cp-chain">
		<span class="cp-chain__label">target</span>
		<select class="cp-chain__select" value={current} {onchange} aria-label="Target chain">
			{#each chains as chain (chain.chainId)}
				<option value={chain.chainId}>{chain.label}</option>
			{/each}
		</select>
	</label>
{:else if chains.length === 1}
	<span class="cp-chain"><span class="cp-chain__label">target</span> <b>{chains[0].label}</b></span>
{/if}
