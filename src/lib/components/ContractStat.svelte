<script lang="ts">
	import { loadConfig } from '$lib/chain/config'
	import { explorerAddressUrl } from '$lib/chain/explorer'

	// Self-contained so both footers can drop it in; re-resolves on a chain switch.
	const cfg = $derived.by(() => {
		try {
			return loadConfig()
		} catch {
			return null
		}
	})
	const url = $derived(cfg ? explorerAddressUrl(cfg.chainId, cfg.registrarAddress, cfg.explorerUrl) : null)
	const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`
</script>

{#if cfg}
	<span class="cp-stat">contract <b>
		{#if url}
			<!-- eslint-disable-next-line svelte/no-navigation-without-resolve external block-explorer URL, not a SvelteKit route -->
			<a href={url} target="_blank" rel="noopener noreferrer">{short(cfg.registrarAddress)}</a>
		{:else}
			{short(cfg.registrarAddress)}
		{/if}
	</b></span>
{/if}

<style>
	a {
		color: var(--verified);
		text-decoration: none;

		&:hover {
			text-decoration: underline;
		}
	}
</style>
