<script lang="ts">
	import type { Address } from 'viem'
	import { parseAddressList } from '$lib/admin/parse'

	let {
		onsubmit,
		submitLabel,
		busy = false,
		disabled = false,
	}: {
		onsubmit: (addresses: Address[]) => void
		submitLabel: string
		busy?: boolean
		disabled?: boolean
	} = $props()

	let raw = $state('')
	const parsed = $derived(parseAddressList(raw))
	const canSubmit = $derived(!busy && !disabled && parsed.valid.length > 0)

	function handleSubmit(event: SubmitEvent) {
		event.preventDefault()
		if (canSubmit) onsubmit(parsed.valid)
	}
</script>

<form class="cp-form" onsubmit={handleSubmit} novalidate>
	<div class="cp-field">
		<label for="wl-addresses">Addresses</label>
		<span class="cp-input-wrap" data-invalid={parsed.invalid.length ? 'true' : 'false'}>
			<textarea
				class="cp-input cp-textarea"
				id="wl-addresses"
				bind:value={raw}
				rows="9"
				autocomplete="off"
				spellcheck="false"
				placeholder="0xabc…&#10;0xdef…&#10;one per line, or comma / space separated"
				aria-describedby="wl-addresses-help"
			></textarea>
		</span>
		<p class="cp-hint" id="wl-addresses-help">
			Paste one address per line (commas, spaces and semicolons also work). Duplicates are removed.
		</p>
	</div>

	<dl class="cp-tally" aria-live="polite">
		<div><dt>valid</dt><dd class="cp-tally--ok">{parsed.valid.length}</dd></div>
		<div><dt>duplicates</dt><dd>{parsed.duplicates}</dd></div>
		<div><dt>invalid</dt><dd class="cp-tally--bad">{parsed.invalid.length}</dd></div>
	</dl>

	{#if parsed.invalid.length}
		<p class="cp-error" role="alert">
			Ignoring {parsed.invalid.length} unrecognised
			{parsed.invalid.length === 1 ? 'entry' : 'entries'} (first: line {parsed.invalid[0].line},
			“{parsed.invalid[0].raw}”).
		</p>
	{/if}

	<button class="cp-btn" type="submit" disabled={!canSubmit}>
		{busy ? 'Submitting…' : `${submitLabel} · ${parsed.valid.length}`}
	</button>
</form>
