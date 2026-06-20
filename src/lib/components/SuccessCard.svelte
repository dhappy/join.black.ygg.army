<script lang="ts">
	import type { Address, Hex } from 'viem'

	let {
		fqName,
		target,
		txHash,
		explorerUrl
	}: { fqName: string, target: Address, txHash: Hex, explorerUrl: string | null } = $props()
</script>

<section role="status" aria-live="polite">
	<h2>You're registered</h2>
	<p><strong>{fqName}</strong> now resolves to <code>{target}</code>.</p>
	<p>
		Transaction:
		{#if explorerUrl}
			<!-- eslint-disable-next-line svelte/no-navigation-without-resolve external block-explorer URL, not a SvelteKit route -->
			<a href={explorerUrl} target="_blank" rel="noopener noreferrer"><code>{txHash}</code></a>
		{:else}
			<code>{txHash}</code>
		{/if}
	</p>
</section>
