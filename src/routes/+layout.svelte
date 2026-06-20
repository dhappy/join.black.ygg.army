<script lang="ts">
	import '$lib/app.css'
	import favicon from '$lib/assets/fist.svg'
	import { loadConfig } from '$lib/chain/config'
	import Backdrop from '$lib/components/Backdrop.svelte'

	let { children } = $props()

	// Tolerate a config-less build (e.g. CI verify) — the real postfix is read client-side too.
	function readPostfix() {
		try {
			return loadConfig().postfix
		} catch {
			return 'black.ygg.army'
		}
	}
	const postfix = readPostfix()
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
