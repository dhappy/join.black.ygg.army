<script lang="ts">
	import type { ErrorCategory } from '$lib/claim/state';

	let { error, onretry }: { error: ErrorCategory; onretry: () => void } = $props();

	const text: Partial<Record<ErrorCategory, string>> = {
		NameTaken: 'That name is already taken. Please choose another.',
		SponsorshipFailed: 'Gas sponsorship is unavailable right now. Please try again shortly.',
		SubmissionFailed: 'The registration could not be submitted. Please try again.'
	};
</script>

<section role="alert">
	<p>{text[error] ?? 'Something went wrong. Please try again.'}</p>
	<button type="button" onclick={onretry}>Try again</button>
</section>
