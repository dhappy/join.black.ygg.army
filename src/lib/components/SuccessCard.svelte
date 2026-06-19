<script lang="ts">
	import type { Address } from 'viem'

	let { fqName, target }: { fqName: string, target: Address } = $props()
</script>

<section role="status" aria-live="polite">
	<h2>You're registered</h2>
	<p><strong>{fqName}</strong> now resolves to <code>{target}</code>.</p>
</section>
