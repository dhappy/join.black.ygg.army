<script lang="ts">
	import type { ErrorCategory } from '$lib/claim/state'
	import StateIcon from './StateIcon.svelte'

	let { error, onretry }: { error: ErrorCategory, onretry: () => void } = $props()

	const text: Partial<Record<ErrorCategory, string>> = {
		NameTaken: 'That name is already taken. Please choose another.',
		SponsorshipFailed: 'Gas sponsorship is unavailable right now. Please try again shortly.',
		SubmissionFailed: 'The registration could not be submitted. Please try again.'
	}
</script>

<section class="cp-alert cp-alert--deny" role="alert">
	<StateIcon kind="Failed" class="cp-icon" />
	<div>
		<p>{text[error] ?? 'Something went wrong. Please try again.'}</p>
		<button class="cp-btn cp-btn--ghost" type="button" onclick={onretry} style="margin-top: 0.9rem">
			Try again
		</button>
	</div>
</section>
