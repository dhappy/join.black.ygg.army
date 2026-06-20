<script lang="ts">
	import { normalizeLabel, previewName } from '$lib/ens/normalize'
	import { validateAddress } from '$lib/ens/address'

	let { onsubmit, postfix }: { onsubmit: (label: string, address: string) => void, postfix: string } =
		$props()

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

<form class="cp-form" onsubmit={handleSubmit} novalidate>
	<div class="cp-field">
		<label for="claim-label">Name</label>
		<span class="cp-input-wrap" data-invalid={labelError ? 'true' : 'false'}>
			<input
				class="cp-input"
				id="claim-label"
				bind:value={label}
				autocomplete="off"
				spellcheck="false"
				aria-invalid={labelError ? 'true' : undefined}
				aria-describedby="claim-label-help{labelError ? ' claim-label-error' : ''}"
			/>
			<span class="cp-input-wrap__suffix" aria-hidden="true">.{postfix}</span>
		</span>
		<p class="cp-hint" id="claim-label-help">
			{preview ? `Will register: ${preview}` : `Your name under .${postfix}`}
		</p>
		{#if labelError}
			<p class="cp-error" id="claim-label-error" role="alert">{labelError}</p>
		{/if}
	</div>

	<div class="cp-field">
		<label for="claim-address">Resolves to address</label>
		<span class="cp-input-wrap" data-invalid={addressError ? 'true' : 'false'}>
			<input
				class="cp-input"
				id="claim-address"
				bind:value={address}
				autocomplete="off"
				spellcheck="false"
				aria-invalid={addressError ? 'true' : undefined}
				aria-describedby={addressError ? 'claim-address-error' : undefined}
			/>
		</span>
		{#if addressError}
			<p class="cp-error" id="claim-address-error" role="alert">{addressError}</p>
		{/if}
	</div>

	<button class="cp-btn" type="submit">Claim name</button>
</form>
