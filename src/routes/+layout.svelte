<script lang="ts">
	import '$lib/app.css'
	import { onMount } from 'svelte'
	import favicon from '$lib/assets/fist.svg'
	import { loadConfig } from '$lib/chain/config'
	import { initActiveChain } from '$lib/chain/active.svelte'
	import Backdrop from '$lib/components/Backdrop.svelte'

	let { children } = $props()

	// Tolerate a config-less build (e.g. CI verify) — the real postfix is read client-side too.
	// Derived so it tracks a chain switch.
	const postfix = $derived.by(() => {
		try {
			return loadConfig().postfix
		} catch {
			return 'black.ygg.army'
		}
	})

	onMount(initActiveChain)
</script>

<svelte:head>
	<title>Claim A Name @ {postfix}</title>
	<link rel="icon" href={favicon} />
</svelte:head>

<Backdrop />
<div class="cp-scanlines" aria-hidden="true"></div>
<div class="cp-app">
	{@render children()}
</div>
