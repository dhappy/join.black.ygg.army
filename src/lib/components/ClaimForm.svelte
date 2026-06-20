<script lang="ts">
	import { normalizeLabel, previewName } from '$lib/ens/normalize'
	import { validateAddress } from '$lib/ens/address'

	let { onsubmit, postfix }: {
		onsubmit: (
			(label: string, address: string) => void
	  ),
		postfix: string
	} = $props()

	let label = $state('')
	let address = $state('')
	let labelError = $state('')
	let addressError = $state('')

	const preview = $derived(previewName(label, postfix))

	function handleSubmit(event: SubmitEvent) {
		event.preventDefault()
		const normalized = normalizeLabel(label)
		const target = validateAddress(address)
		labelError = normalized.ok ? '' : 'Enter a valid name (letters, digits, hyphens).'
		addressError = target.ok ? '' : 'Enter a valid address (starts with 0x).'
		if (normalized.ok && target.ok) onsubmit(label, address)
	}
</script>

<form onsubmit={handleSubmit} novalidate>
	<div>
		<label>
			<span>Name</span>
			<input
				id="claim-label"
				bind:value={label}
				autocomplete="off"
				aria-invalid={labelError ? 'true' : undefined}
				aria-describedby="claim-label-help{labelError ? ' claim-label-error' : ''}"
			/>
		</label>
		<p id="claim-label-help">
			{preview ? `Will register: ${preview}` : `Your name under .${postfix}`}
		</p>
		{#if labelError}
			<p id="claim-label-error" role="alert">{labelError}</p>
		{/if}
	</div>

	<div>
		<label for="claim-address">Resolves to address</label>
		<input
			id="claim-address"
			bind:value={address}
			autocomplete="off"
			aria-invalid={addressError ? 'true' : undefined}
			aria-describedby={addressError ? 'claim-address-error' : undefined}
		/>
		{#if addressError}
			<p id="claim-address-error" role="alert">{addressError}</p>
		{/if}
	</div>

	<button type="submit">Claim name</button>
</form>
