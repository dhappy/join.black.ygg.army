<script lang="ts">
	import favicon from '$lib/assets/fist.svg'
	import { loadConfig } from '$lib/chain/config'

	let { children } = $props()

	const { postfix } = loadConfig()
</script>

<svelte:head>
	<title>Claim A Name @ {postfix}</title>
	<link rel="icon" href={favicon} />
</svelte:head>

{@render children()}
