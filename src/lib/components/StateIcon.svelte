<script lang="ts">
	import type { ClaimState } from '$lib/claim/state'

	let { kind, class: klass = 'cp-icon' }: { kind: ClaimState['kind'], class?: string } = $props()

	const busy = $derived(
		kind === 'LoadingLink' ||
			kind === 'CheckingWhitelist' ||
			kind === 'Submitting' ||
			kind === 'Pending'
	)
</script>

<svg
	class={klass}
	viewBox="0 0 24 24"
	fill="none"
	stroke="currentColor"
	stroke-width="1.7"
	stroke-linecap="round"
	stroke-linejoin="round"
	aria-hidden="true"
>
	{#if busy}
		<g class="cp-spin">
			<circle cx="12" cy="12" r="8.5" stroke-dasharray="3 5" opacity="0.45" />
			<path d="M12 3.5 A8.5 8.5 0 0 1 20.5 12" />
		</g>
	{:else if kind === 'Ready'}
		<!-- key seed -->
		<circle cx="8" cy="8" r="4" />
		<path d="M11 11 L20 20 M17 17 L19.5 14.5 M14 14 L16 16" />
	{:else if kind === 'Success'}
		<!-- check in hexagon -->
		<path d="M12 3 L19 7 L19 17 L12 21 L5 17 L5 7 Z" />
		<path d="M8.5 12 L11 14.5 L15.5 9.5" />
	{:else if kind === 'MissingKey'}
		<!-- absent key: dashed key outline -->
		<circle cx="8" cy="8" r="4" stroke-dasharray="1.5 2" opacity="0.6" />
		<path d="M11 11 L20 20 M17 17 L19.5 14.5 M14 14 L16 16" stroke-dasharray="1.5 2" opacity="0.6" />
	{:else if kind === 'InvalidLink'}
		<!-- broken link -->
		<path d="M9 15 L7 17 a3 3 0 0 1-4-4 L5 11 M15 9 L17 7 a3 3 0 0 1 4 4 L19 13" />
		<path d="M10 14 L14 10" opacity="0.45" stroke-dasharray="1.5 2" />
	{:else if kind === 'NotAuthorized'}
		<!-- key with X -->
		<circle cx="8" cy="8" r="4" />
		<path d="M11 11 L16 16" />
		<path d="M17 13 L21 17 M21 13 L17 17" />
	{:else if kind === 'AlreadyRedeemed'}
		<!-- spent stamp -->
		<rect x="4" y="6" width="16" height="12" rx="1" />
		<path d="M4 18 L20 6" />
		<path d="M7.5 10 L9.5 12 L13 8.5" opacity="0.6" />
	{:else}
		<!-- Failed: alert -->
		<path d="M12 4 L21 19 L3 19 Z" />
		<path d="M12 10 L12 14 M12 16.5 L12 16.6" />
	{/if}
</svg>
