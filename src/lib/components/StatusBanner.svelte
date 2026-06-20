<script lang="ts">
	import type { ClaimState } from '$lib/claim/state'

	let { state }: { state: ClaimState } = $props()

	const messages: Record<ClaimState['kind'], string> = {
		LoadingLink: 'Checking your invitation…',
		CheckingWhitelist: 'Verifying your invitation…',
		InvalidLink: 'This invitation link is invalid.',
		NotAuthorized: 'This link is not authorized.',
		AlreadyRedeemed: 'This invitation has already been used.',
		Ready: 'Choose the name you want.',
		Submitting: 'Submitting your registration…',
		Pending: 'Waiting for confirmation…',
		Success: 'Your name is registered.',
		Failed: 'Something went wrong.'
	}
</script>

<span class="cp-live" role="status" aria-live="polite">{messages[state.kind]}</span>
