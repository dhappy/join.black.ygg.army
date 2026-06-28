<script lang="ts">
	import type { Address, Hex } from 'viem'

	let {
		fqName,
		target,
		txHash,
		explorerUrl,
	}: { fqName: string, target: Address, txHash: Hex, explorerUrl: string | null } = $props()
</script>

<section class="cp-success" role="status" aria-live="polite">
	<p class="cp-resolves"><strong>{fqName}</strong> resolves to <code>{target}</code></p>
	<div class="cp-tx">
		<span>Transaction</span>
		{#if explorerUrl}
			<!-- eslint-disable-next-line svelte/no-navigation-without-resolve external block-explorer URL, not a SvelteKit route -->
			<a href={explorerUrl} target="_blank" rel="noopener noreferrer">{txHash}</a>
		{:else}
			<code>{txHash}</code>
		{/if}
	</div>
</section>
